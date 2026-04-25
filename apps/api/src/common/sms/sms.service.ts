import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Dypnsapi20170525, * as $Dypnsapi20170525 from "@alicloud/dypnsapi20170525";
import OpenApi, * as $OpenApi from "@alicloud/openapi-client";
import Util, * as $Util from "@alicloud/tea-util";
import { RedisService } from "../redis/redis.service";

@Injectable()
export class SmsService {
  private client: Dypnsapi20170525 | null = null;
  private readonly enabled: boolean;

  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
  ) {
    this.enabled =
      this.configService.get<boolean>("aliyun.sms.enabled") ?? false;
    const accessKeyId = this.configService.get<string>(
      "aliyun.sms.accessKeyId",
    );
    const accessKeySecret = this.configService.get<string>(
      "aliyun.sms.accessKeySecret",
    );

    // 只在启用真实短信服务时初始化客户端
    if (this.enabled && accessKeyId && accessKeySecret) {
      const config = new $OpenApi.Config({
        accessKeyId,
        accessKeySecret,
      });
      config.endpoint = "dypnsapi.aliyuncs.com";
      this.client = new Dypnsapi20170525(config as any);
    }
  }

  /**
   * 发送短信验证码
   * 根据配置决定：
   * - 启用状态 (SMS_ENABLED=true): 调用阿里云号码验证服务发送真实短信
   * - 禁用状态 (SMS_ENABLED=false): 仅将验证码存入 Redis，不发送真实短信（开发测试用）
   */
  async sendVerificationCode(
    phone: string,
    code: string,
    type: "login" | "register" | "reset_password" | "change_phone",
  ): Promise<boolean> {
    // 无论是否启用真实短信，都将验证码存入 Redis 用于后续验证
    await this.redisService.setSmsCode(phone, type, code);

    // 如果未启用真实短信服务，直接返回成功（开发测试模式）
    if (!this.enabled) {
      console.log(
        `[开发模式] 验证码已生成: phone=${phone}, type=${type}, code=${code}`,
      );
      return true;
    }

    // 启用真实短信服务，调用阿里云 API
    if (!this.client) {
      console.warn("SMS client not initialized");
      return false;
    }

    const signName = this.configService.get<string>("aliyun.sms.signName");
    const templateCode = this.configService.get<string>(
      `aliyun.sms.templateCodes.${type}`,
    );

    if (!signName || !templateCode) {
      console.warn(`SMS template not configured for type: ${type}`);
      return false;
    }

    try {
      const sendSmsVerifyCodeRequest =
        new $Dypnsapi20170525.SendSmsVerifyCodeRequest({
          phoneNumber: phone,
          signName,
          templateCode,
          templateParam: JSON.stringify({ code, min: "5" }),
          codeLength: 6,
          validTime: 300, // 5分钟有效期
        });

      const runtime = new $Util.RuntimeOptions({});
      const response = await this.client.sendSmsVerifyCodeWithOptions(
        sendSmsVerifyCodeRequest,
        runtime,
      );

      return response.body?.code === "OK";
    } catch (error: any) {
      console.error("SMS send error:", error.message);
      if (error.data?.["Recommend"]) {
        console.error("诊断地址:", error.data["Recommend"]);
      }
      return false;
    }
  }

  /**
   * 检查是否配置真实短信服务
   */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * 检查是否启用真实短信发送
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}
