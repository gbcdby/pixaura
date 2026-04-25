import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import Mail from "nodemailer/lib/mailer";

@Injectable()
export class MailService {
  private transporter: Mail | null = null;

  constructor(private configService: ConfigService) {
    const host = this.configService.get<string>("mail.smtp.host");
    const port = this.configService.get<number>("mail.smtp.port");
    const secure = this.configService.get<boolean>("mail.smtp.secure");
    const user = this.configService.get<string>("mail.smtp.from");
    const pass = this.configService.get<string>("mail.smtp.password");

    if (host && port && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass,
        },
      });
    }
  }

  /**
   * 发送邮件
   */
  async sendMail(to: string, subject: string, html: string): Promise<boolean> {
    if (!this.transporter) {
      console.warn("Mail service not configured");
      return false;
    }

    try {
      const from = this.configService.get<string>("mail.smtp.from");
      const fromName = this.configService.get<string>("mail.smtp.fromName");

      await this.transporter.sendMail({
        from: `"${fromName}" <${from}>`,
        to,
        subject,
        html,
      });
      return true;
    } catch (error) {
      console.error("Send mail error:", error);
      return false;
    }
  }

  /**
   * 发送邮箱验证邮件
   */
  async sendVerificationEmail(to: string, token: string): Promise<boolean> {
    const appUrl = this.configService.get<string>("app.url");
    const verifyUrl = `${appUrl}/api/auth/verify-email?token=${token}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">邮箱验证</h2>
        <p>您好！</p>
        <p>请点击下方链接验证您的邮箱地址：</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${verifyUrl}"
             style="display: inline-block; padding: 12px 24px;
                    background-color: #4CAF50; color: white;
                    text-decoration: none; border-radius: 4px;">
            验证邮箱
          </a>
        </p>
        <p>或者复制以下链接到浏览器：</p>
        <p style="word-break: break-all; color: #666;">${verifyUrl}</p>
        <p style="color: #999; font-size: 12px;">此链接24小时内有效，请勿分享给他人。</p>
        <p style="color: #999; font-size: 12px;">如果您没有发起此请求，请忽略此邮件。</p>
      </div>
    `;

    return this.sendMail(to, "Pixaura - 邮箱验证", html);
  }

  /**
   * 发送验证码邮件
   */
  async sendVerificationCodeEmail(to: string, code: string): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">邮箱验证码</h2>
        <p>您好！</p>
        <p>您正在进行邮箱验证操作，验证码为：</p>
        <p style="text-align: center; margin: 30px 0; font-size: 32px; font-weight: bold; color: #4CAF50; letter-spacing: 8px;">
          ${code}
        </p>
        <p style="color: #999; font-size: 12px;">此验证码5分钟内有效，请勿分享给他人。</p>
        <p style="color: #999; font-size: 12px;">如果您没有发起此请求，请忽略此邮件。</p>
      </div>
    `;

    return this.sendMail(to, "Pixaura - 邮箱验证码", html);
  }

  /**
   * 检查是否配置
   */
  isConfigured(): boolean {
    return this.transporter !== null;
  }
}
