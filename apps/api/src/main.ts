import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// 尽早加载环境变量
const envPaths = [
  path.resolve(__dirname, "../.env"),
  path.resolve(__dirname, "../../.env"),
];
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, processEnv: process.env });
    break;
  }
}

import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { ValidationPipe, HttpException, HttpStatus } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import fastifyCookie from "@fastify/cookie";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { AppModule } from "./app.module";
import { TransformResponseInterceptor } from "./common/interceptors/transform-response.interceptor";
import { SnakeToCamelInterceptor } from "./common/interceptors/snake-to-camel.interceptor";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: true,
      bodyLimit: 50 * 1024 * 1024, // 50MB，支持图片/视频文件上传
    }),
  );

  // 注册 Fastify 插件
  await app.register(fastifyCookie, {
    secret: process.env.COOKIE_SECRET || "cookie-secret",
  });
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
      files: 5, // 单次最多 5 个文件
    },
  });

  // 本地存储模式：注册静态文件服务
  const configService = app.get(ConfigService);
  const storageType = configService.get<string>("storage.type");
  if (storageType === "local") {
    const localDir =
      configService.get<string>("storage.local.dir") || "./uploads";
    const absolutePath = path.resolve(process.cwd(), localDir);

    // 确保上传目录存在
    if (!fs.existsSync(absolutePath)) {
      fs.mkdirSync(absolutePath, { recursive: true });
    }

    // 确保临时文件目录存在
    const tempDir = path.join(absolutePath, "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
      console.log("[Storage] Created temp directory: " + tempDir);
    }

    await app.register(fastifyStatic, {
      root: absolutePath,
      prefix: "/static/",
      decorateReply: true,
    });

    console.log(`[Storage] Static files served from: ${absolutePath}`);

    // 检测 ngrok 状态
    const ngrokRunning = await checkNgrokStatus();
    if (ngrokRunning) {
      console.log("[Storage] ngrok 已启动，后端将自动获取公网 URL");
    } else {
      console.warn(
        "[Storage] ngrok 未启动，部分功能（火山引擎主体检测、对口型视频生成）需要公网 URL。\n" +
          "请在另一个终端运行: ngrok http 3000",
      );
    }
  }

  // 允许 Content-Type: application/json 但 body 为空的请求（如 dedup-check）
  // 使用 FastifyAdapter.useBodyParser() 注册自定义 parser，该方法会自动设置
  // _isParserRegistered = true，防止 NestJS 在 init() 时再次注册导致冲突
  app.useBodyParser(
    "application/json",
    {},
    (
      _req: unknown,
      body: Buffer,
      done: (err: null, result: unknown) => void,
    ) => {
      const raw = body.toString("utf8").trim();
      if (!raw) {
        done(null, {});
        return;
      }
      try {
        done(null, JSON.parse(raw));
      } catch {
        done(null, {});
      }
    },
  );

  // CORS 配置
  app.enableCors({
    origin: process.env.WEB_URL || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  });

  // 全局管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      errorHttpStatusCode: HttpStatus.BAD_REQUEST,
      exceptionFactory: (errors) => {
        return new HttpException(
          {
            code: 2,
            message: "参数错误",
            errors: errors.map((err) => ({
              field: err.property,
              errors: Object.values(err.constraints || {}),
            })),
          },
          HttpStatus.BAD_REQUEST,
        );
      },
      transformOptions: {
        enableImplicitConversion: false,
      },
    }),
  );

  // 全局异常过滤器
  app.useGlobalFilters(new HttpExceptionFilter());

  // 全局拦截器
  app.useGlobalInterceptors(
    new TransformResponseInterceptor(),
    new SnakeToCamelInterceptor(),
  );

  // 全局前缀（必须在 Swagger 之前设置）
  // 内部接口 /internal 不走 /api 前缀
  app.setGlobalPrefix("api", { exclude: ["internal/(.*)"] });

  // Swagger 文档
  const config = new DocumentBuilder()
    .setTitle("Pixaura API")
    .setDescription("AI 短剧生成平台 API 文档")
    .setVersion("1.0")
    .addCookieAuth("accessToken")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  const port = process.env.APP_PORT || 3000;
  await app.listen(port, "0.0.0.0");
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

/**
 * 检测 ngrok 是否运行
 * 用于启动时显示提示信息
 */
async function checkNgrokStatus(): Promise<boolean> {
  try {
    const ngrokApiUrl = process.env.NGROK_API_URL || "http://127.0.0.1:4040";
    const response = await fetch(`${ngrokApiUrl}/api/tunnels`, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

bootstrap();

