import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// 加载环境变量 - 尝试多个可能的路径
const possibleEnvPaths = [
  path.resolve(__dirname, "../../.env"), // 从 dist/config 到项目根目录
  path.resolve(__dirname, "../../../.env"), // 从 src/config 到项目根目录
  path.resolve(process.cwd(), ".env"), // 当前工作目录
  path.resolve(process.cwd(), "../.env"), // 当前工作目录上级
];

for (const envPath of possibleEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, processEnv: process.env });
    break;
  }
}

export default () => ({
  app: {
    port: parseInt(process.env.APP_PORT || "3000", 10),
    env: process.env.APP_ENV || "development",
    url: process.env.APP_URL || "http://localhost:3000",
    webUrl: process.env.WEB_URL || "http://localhost:5173",
  },
  database: {
    host: process.env.DATABASE_HOST || "localhost",
    port: parseInt(process.env.DATABASE_PORT || "5432", 10),
    user: process.env.DATABASE_USER || "pixaura",
    password: process.env.DATABASE_PASSWORD || "pixaura123",
    name: process.env.DATABASE_NAME || "pixaura",
  },
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD,
  },
  jwt: {
    secret: process.env.JWT_SECRET || "your-jwt-secret",
    accessExpiration: process.env.JWT_ACCESS_EXPIRATION || "2h",
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || "7d",
  },
  aliyun: {
    sms: {
      enabled: process.env.SMS_ENABLED === "true",
      accessKeyId: process.env.ALIYUN_SMS_ACCESS_KEY_ID,
      accessKeySecret: process.env.ALIYUN_SMS_ACCESS_KEY_SECRET,
      signName: process.env.ALIYUN_SMS_SIGN_NAME,
      templateCodes: {
        login: process.env.ALIYUN_SMS_TEMPLATE_CODE_LOGIN,
        register: process.env.ALIYUN_SMS_TEMPLATE_CODE_REGISTER,
        resetPassword: process.env.ALIYUN_SMS_TEMPLATE_CODE_RESET_PASSWORD,
        changePhone: process.env.ALIYUN_SMS_TEMPLATE_CODE_CHANGE_PHONE,
      },
    },
    oss: {
      region: process.env.OSS_REGION,
      accessKeyId: process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
      bucket: process.env.OSS_BUCKET,
      endpoint: process.env.OSS_ENDPOINT,
    },
  },
  storage: {
    type: process.env.STORAGE_TYPE || "oss", // 'oss' | 'local'
    local: {
      dir: process.env.LOCAL_STORAGE_DIR || "./uploads",
    },
  },
  mail: {
    smtp: {
      host: process.env.MAIL_SMTP_HOST,
      port: parseInt(process.env.MAIL_SMTP_PORT || "465", 10),
      secure: process.env.MAIL_SMTP_SECURE === "true",
      from: process.env.MAIL_FROM_ADDRESS,
      fromName: process.env.MAIL_FROM_NAME,
      password: process.env.MAIL_FROM_PASSWORD,
    },
  },
  internal: {
    apiKey:
      process.env.INTERNAL_API_KEY || "internal-api-key-change-in-production",
  },
  ai: {
    streaming: {
      enabled: process.env.AI_STREAMING_ENABLED !== "false",
      bufferSize: parseInt(process.env.AI_STREAM_BUFFER_SIZE || "10", 10),
      timeWindowMs: parseInt(process.env.AI_STREAM_TIME_WINDOW || "50", 10),
      timeout: {
        first: parseInt(process.env.AI_STREAM_TIMEOUT_FIRST || "10000", 10),
        between: parseInt(process.env.AI_STREAM_TIMEOUT_BETWEEN || "30000", 10),
        total: parseInt(process.env.AI_STREAM_TIMEOUT_TOTAL || "300000", 10),
      },
    },
  },
});
