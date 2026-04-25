import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(private configService: ConfigService) {
    this.client = new Redis({
      host: this.configService.get("redis.host"),
      port: this.configService.get("redis.port"),
      password: this.configService.get("redis.password"),
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });
  }

  getClient(): Redis {
    return this.client;
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  // ==================== 验证码相关 ====================

  /**
   * 存储短信验证码
   */
  async setSmsCode(phone: string, type: string, code: string): Promise<void> {
    const key = `sms:${type}:${phone}`;
    await this.client.setex(key, 300, code); // 5分钟过期
  }

  /**
   * 获取短信验证码
   */
  async getSmsCode(phone: string, type: string): Promise<string | null> {
    const key = `sms:${type}:${phone}`;
    return this.client.get(key);
  }

  /**
   * 删除短信验证码
   */
  async deleteSmsCode(phone: string, type: string): Promise<void> {
    const key = `sms:${type}:${phone}`;
    await this.client.del(key);
  }

  /**
   * 增加验证码验证失败次数
   */
  async incrSmsVerifyFail(phone: string): Promise<number> {
    const key = `sms:verify:fail:${phone}`;
    const count = await this.client.incr(key);
    await this.client.expire(key, 3600); // 1小时过期
    return count;
  }

  /**
   * 获取验证码验证失败次数
   */
  async getSmsVerifyFail(phone: string): Promise<number> {
    const key = `sms:verify:fail:${phone}`;
    const count = await this.client.get(key);
    return parseInt(count || "0", 10);
  }

  /**
   * 清除验证码验证失败次数
   */
  async clearSmsVerifyFail(phone: string): Promise<void> {
    const key = `sms:verify:fail:${phone}`;
    await this.client.del(key);
  }

  // ==================== 邮箱验证相关 ====================

  /**
   * 存储邮箱验证令牌
   */
  async setEmailVerifyToken(userId: string, token: string): Promise<void> {
    const key = `email:verify:${token}`;
    await this.client.setex(key, 86400, userId); // 24小时过期
  }

  /**
   * 获取邮箱验证令牌
   */
  async getEmailVerifyToken(token: string): Promise<string | null> {
    const key = `email:verify:${token}`;
    return this.client.get(key);
  }

  /**
   * 删除邮箱验证令牌
   */
  async deleteEmailVerifyToken(token: string): Promise<void> {
    const key = `email:verify:${token}`;
    await this.client.del(key);
  }

  /**
   * 存储邮箱验证码（用于修改邮箱）
   */
  async setEmailCode(
    userId: string,
    email: string,
    code: string,
  ): Promise<void> {
    const key = `email:code:${userId}:${email}`;
    await this.client.setex(key, 300, code); // 5分钟过期
  }

  /**
   * 获取邮箱验证码
   */
  async getEmailCode(userId: string, email: string): Promise<string | null> {
    const key = `email:code:${userId}:${email}`;
    return this.client.get(key);
  }

  /**
   * 删除邮箱验证码
   */
  async deleteEmailCode(userId: string, email: string): Promise<void> {
    const key = `email:code:${userId}:${email}`;
    await this.client.del(key);
  }

  /**
   * 检查邮箱验证码发送冷却时间
   */
  async checkEmailCooldown(userId: string): Promise<boolean> {
    const key = `email:cooldown:${userId}`;
    const exists = await this.client.exists(key);
    return exists === 1;
  }

  /**
   * 设置邮箱验证码发送冷却时间
   */
  async setEmailCooldown(userId: string): Promise<void> {
    const key = `email:cooldown:${userId}`;
    await this.client.setex(key, 60, "1"); // 60秒冷却
  }

  /**
   * 增加邮箱发送日计数
   */
  async incrementEmailDailyCount(email: string): Promise<number> {
    const today = new Date().toISOString().split("T")[0];
    const key = `email:daily:${email}:${today}`;
    return this.increment(key, 86400);
  }

  /**
   * 获取邮箱发送日计数
   */
  async getEmailDailyCount(email: string): Promise<number> {
    const today = new Date().toISOString().split("T")[0];
    const key = `email:daily:${email}:${today}`;
    return this.getCount(key);
  }

  // ==================== Session 相关 ====================

  /**
   * 存储 Session
   */
  async setSession(
    userId: string,
    sessionId: string,
    data: {
      refreshTokenHash: string;
      deviceType: string;
      ip: string;
      createdAt: Date;
      remember?: boolean;
    },
  ): Promise<void> {
    const key = `session:${userId}:${sessionId}`;
    // 记住我：30天过期，普通：7天过期
    const ttl = data.remember ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60;
    await this.client.setex(key, ttl, JSON.stringify(data));
  }

  /**
   * 获取 Session
   */
  async getSession(
    userId: string,
    sessionId: string,
  ): Promise<Record<string, unknown> | null> {
    const key = `session:${userId}:${sessionId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * 删除 Session
   */
  async deleteSession(userId: string, sessionId: string): Promise<void> {
    const key = `session:${userId}:${sessionId}`;
    await this.client.del(key);
  }

  /**
   * 删除用户所有 Session
   */
  async deleteAllUserSessions(userId: string): Promise<void> {
    const pattern = `session:${userId}:*`;
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  /**
   * 获取用户所有 Session
   */
  async getUserSessions(
    userId: string,
  ): Promise<{ id: string; data: Record<string, unknown> }[]> {
    const pattern = `session:${userId}:*`;
    const keys = await this.client.keys(pattern);
    const sessions: { id: string; data: Record<string, unknown> }[] = [];
    for (const key of keys) {
      const data = await this.client.get(key);
      if (data) {
        const sessionId = key.split(":").pop() || "";
        sessions.push({ id: sessionId, data: JSON.parse(data) });
      }
    }
    return sessions;
  }

  // ==================== Token 黑名单 ====================

  /**
   * 将 Token 加入黑名单
   */
  async addToTokenBlacklist(token: string, expiresIn: number): Promise<void> {
    const key = `token:blacklist:${token}`;
    await this.client.setex(key, expiresIn, "1");
  }

  /**
   * 检查 Token 是否在黑名单
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    const key = `token:blacklist:${token}`;
    const exists = await this.client.exists(key);
    return exists === 1;
  }

  // ==================== Token 刷新防竞态 ====================

  /**
   * 缓存刷新后的 Token
   */
  async setTokenRefresh(userId: string, tokenData: string): Promise<void> {
    const key = `token:refresh:${userId}`;
    await this.client.setex(key, 5, tokenData); // 5秒窗口期
  }

  /**
   * 获取缓存的刷新 Token
   */
  async getTokenRefresh(userId: string): Promise<string | null> {
    const key = `token:refresh:${userId}`;
    return this.client.get(key);
  }

  // ==================== 限流相关 ====================

  /**
   * 增加计数器
   */
  async increment(key: string, window: number): Promise<number> {
    const multi = this.client.multi();
    multi.incr(key);
    multi.expire(key, window);
    const results = await multi.exec();
    return (results?.[0]?.[1] as number) || 0;
  }

  /**
   * 获取计数器值
   */
  async getCount(key: string): Promise<number> {
    const count = await this.client.get(key);
    return parseInt(count || "0", 10);
  }

  // ==================== 头像上传限制 ====================

  /**
   * 增加用户今日头像上传次数
   */
  async incrementAvatarUpload(userId: string): Promise<number> {
    const today = new Date().toISOString().split("T")[0];
    const key = `avatar:upload:${userId}:${today}`;
    return this.increment(key, 86400);
  }

  /**
   * 获取用户今日头像上传次数
   */
  async getAvatarUploadCount(userId: string): Promise<number> {
    const today = new Date().toISOString().split("T")[0];
    const key = `avatar:upload:${userId}:${today}`;
    return this.getCount(key);
  }

  // ==================== 手机换绑验证令牌 ====================

  /**
   * 存储手机换绑验证令牌
   */
  async setPhoneVerifyToken(userId: string, token: string): Promise<void> {
    const key = `phone:verify:${token}`;
    await this.client.setex(key, 1800, userId); // 30分钟过期
  }

  /**
   * 获取手机换绑验证令牌
   */
  async getPhoneVerifyToken(token: string): Promise<string | null> {
    const key = `phone:verify:${token}`;
    return this.client.get(key);
  }

  /**
   * 删除手机换绑验证令牌
   */
  async deletePhoneVerifyToken(token: string): Promise<void> {
    const key = `phone:verify:${token}`;
    await this.client.del(key);
  }

  // ==================== 短信发送频率限制 ====================

  /**
   * 检查短信发送冷却时间
   */
  async checkSmsCooldown(phone: string, type: string): Promise<boolean> {
    const key = `sms:cooldown:${type}:${phone}`;
    const exists = await this.client.exists(key);
    return exists === 1;
  }

  /**
   * 设置短信发送冷却时间
   */
  async setSmsCooldown(phone: string, type: string): Promise<void> {
    const key = `sms:cooldown:${type}:${phone}`;
    await this.client.setex(key, 60, "1"); // 60秒冷却
  }

  /**
   * 增加短信发送日计数
   */
  async incrementSmsDailyCount(phone: string): Promise<number> {
    const today = new Date().toISOString().split("T")[0];
    const key = `sms:daily:${phone}:${today}`;
    return this.increment(key, 86400);
  }

  /**
   * 获取短信发送日计数
   */
  async getSmsDailyCount(phone: string): Promise<number> {
    const today = new Date().toISOString().split("T")[0];
    const key = `sms:daily:${phone}:${today}`;
    return this.getCount(key);
  }
}
