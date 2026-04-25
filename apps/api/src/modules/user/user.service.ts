import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as argon2 from "argon2";
import { v4 as uuidv4 } from "uuid";
import { User } from "./entities/user.entity";
import { RedisService } from "../../common/redis/redis.service";
import { SmsService } from "../../common/sms/sms.service";
import { MailService } from "../../common/mail/mail.service";
import { OssService } from "../../common/oss/oss.service";
import {
  AuthException,
  ValidationException,
  BusinessException,
} from "../../common/exceptions/auth.exception";
import type { UserResponseDto } from "@pixaura/shared-types";
import { ErrorCodes, FileCategory } from "@pixaura/shared-types";

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private redisService: RedisService,
    private smsService: SmsService,
    private mailService: MailService,
    private ossService: OssService,
  ) {}

  /**
   * 根据 ID 查找用户
   */
  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  /**
   * 更新最后登录时间
   */
  async updateLastLoginAt(userId: string): Promise<void> {
    await this.userRepository.update(userId, { lastLoginAt: new Date() });
  }

  /**
   * 根据用户名查找用户
   */
  async findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { username } });
  }

  /**
   * 根据手机号查找用户
   */
  async findByPhone(phone: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { phone } });
  }

  /**
   * 根据邮箱查找用户
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  /**
   * 检查用户名是否存在
   */
  async checkUsernameExists(username: string): Promise<boolean> {
    const count = await this.userRepository.count({ where: { username } });
    return count > 0;
  }

  /**
   * 注册用户
   */
  async register(
    phone: string,
    username: string,
    password: string,
    code: string,
    email?: string,
  ): Promise<User> {
    // 验证验证码
    await this.verifySmsCode(phone, "register", code);

    // 检查手机号是否已注册
    const existingUser = await this.findByPhone(phone);
    if (existingUser) {
      throw new BusinessException("PHONE_ALREADY_EXISTS");
    }

    // 检查用户名是否已存在
    const usernameExists = await this.checkUsernameExists(username);
    if (usernameExists) {
      throw new BusinessException("USERNAME_ALREADY_EXISTS");
    }

    // 如果提供了邮箱，检查邮箱是否已被使用
    if (email) {
      const existingEmail = await this.findByEmail(email);
      if (existingEmail) {
        throw new BusinessException("EMAIL_ALREADY_EXISTS");
      }
    }

    // 加密密码
    const passwordHash = await argon2.hash(password);

    // 创建用户
    const user = this.userRepository.create({
      phone,
      username,
      passwordHash,
      email: email || null,
      emailVerified: false,
      avatar: null,
      bio: null,
      perms: 0,
      subscriptionTier: "free",
      balance: 0,
      isBanned: false,
    });

    return this.userRepository.save(user);
  }

  /**
   * 账号密码登录
   */
  async login(username: string, password: string): Promise<User> {
    // 支持用户名、手机号、邮箱登录
    let user: User | null = await this.findByUsername(username);
    if (!user) {
      user = await this.findByPhone(username);
    }
    if (!user && username.includes("@")) {
      user = await this.findByEmail(username);
    }

    if (!user) {
      throw new BusinessException("INVALID_CREDENTIALS");
    }

    // 检查账号是否被封禁
    if (user.isBanned) {
      throw new BusinessException("ACCOUNT_BANNED");
    }

    // 验证密码
    const isPasswordValid = await argon2.verify(user.passwordHash, password);
    if (!isPasswordValid) {
      throw new BusinessException("INVALID_CREDENTIALS");
    }

    // 更新最后登录时间
    await this.updateLastLoginAt(user.id);

    return user;
  }

  /**
   * 手机号验证码登录
   */
  async loginByPhone(phone: string, code: string): Promise<User> {
    // 验证验证码
    await this.verifySmsCode(phone, "login", code);

    // 查找用户
    const user = await this.findByPhone(phone);
    if (!user) {
      throw new BusinessException("USER_NOT_FOUND");
    }

    // 检查账号是否被封禁
    if (user.isBanned) {
      throw new BusinessException("ACCOUNT_BANNED");
    }

    // 更新最后登录时间
    await this.updateLastLoginAt(user.id);

    return user;
  }

  /**
   * 重置密码
   */
  async resetPassword(
    phone: string,
    code: string,
    newPassword: string,
  ): Promise<void> {
    // 验证验证码
    await this.verifySmsCode(phone, "reset_password", code);

    // 查找用户
    const user = await this.findByPhone(phone);
    if (!user) {
      throw new BusinessException("USER_NOT_FOUND");
    }

    // 加密新密码
    const passwordHash = await argon2.hash(newPassword);

    // 更新密码
    await this.userRepository.update(user.id, { passwordHash });

    // 清除用户所有 Session（安全策略）
    await this.redisService.deleteAllUserSessions(user.id);
  }

  /**
   * 修改密码
   */
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.findById(userId);
    if (!user) {
      throw new BusinessException("USER_NOT_FOUND");
    }

    // 验证旧密码
    const isPasswordValid = await argon2.verify(user.passwordHash, oldPassword);
    if (!isPasswordValid) {
      throw new BusinessException("INVALID_PASSWORD");
    }

    // 加密新密码
    const passwordHash = await argon2.hash(newPassword);

    // 更新密码
    await this.userRepository.update(userId, { passwordHash });

    // 清除用户所有 Session（安全策略）
    await this.redisService.deleteAllUserSessions(userId);
  }

  /**
   * 更新用户信息
   */
  async updateProfile(
    userId: string,
    data: {
      username?: string;
      bio?: string;
      email?: string;
      emailVerified?: boolean;
    },
  ): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new BusinessException("USER_NOT_FOUND");
    }

    // 如果更新用户名，检查唯一性
    if (data.username && data.username !== user.username) {
      const existingUser = await this.findByUsername(data.username);
      if (existingUser) {
        throw new BusinessException("USERNAME_ALREADY_EXISTS");
      }
    }

    // 如果更新邮箱，需要重新验证
    if (data.email && data.email !== user.email) {
      const existingEmail = await this.findByEmail(data.email);
      if (existingEmail) {
        throw new BusinessException("EMAIL_ALREADY_EXISTS");
      }
      data.emailVerified = false;
    }

    await this.userRepository.update(userId, data);
    return this.findById(userId) as Promise<User>;
  }

  /**
   * 生成手机换绑验证令牌
   */
  async generatePhoneVerifyToken(userId: string): Promise<string> {
    const token = uuidv4();
    await this.redisService.setPhoneVerifyToken(userId, token);
    return token;
  }

  /**
   * 修改手机号
   */
  async changePhone(
    userId: string,
    newPhone: string,
    code: string,
    verifyToken: string,
  ): Promise<void> {
    // 验证换绑令牌
    const tokenUserId =
      await this.redisService.getPhoneVerifyToken(verifyToken);
    if (!tokenUserId || tokenUserId !== userId) {
      throw new BusinessException("INVALID_VERIFY_TOKEN");
    }

    const user = await this.findById(userId);
    if (!user) {
      throw new BusinessException("USER_NOT_FOUND");
    }

    // 检查是否与旧手机号相同
    if (newPhone === user.phone) {
      throw new BusinessException("SAME_PHONE_NUMBER");
    }

    // 检查30天限制
    if (user.phoneChangedAt) {
      const daysSinceChange =
        (Date.now() - user.phoneChangedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceChange < 30) {
        throw new BusinessException("PHONE_CHANGE_TOO_FREQUENT");
      }
    }

    // 验证新手机号的验证码
    await this.verifySmsCode(newPhone, "change_phone", code);

    // 检查新手机号是否已被使用
    const existingUser = await this.findByPhone(newPhone);
    if (existingUser) {
      throw new BusinessException("PHONE_ALREADY_EXISTS");
    }

    // 更新手机号
    await this.userRepository.update(userId, {
      phone: newPhone,
      phoneChangedAt: new Date(),
    });

    // 删除验证令牌
    await this.redisService.deletePhoneVerifyToken(verifyToken);

    // 清除用户所有 Session（安全策略）
    await this.redisService.deleteAllUserSessions(userId);
  }

  /**
   * 上传头像
   */
  async uploadAvatar(
    userId: string,
    buffer: Buffer,
    filename: string,
  ): Promise<string> {
    // 检查上传限制
    const uploadCount = await this.redisService.getAvatarUploadCount(userId);
    if (uploadCount >= 3) {
      throw new BusinessException("AVATAR_UPLOAD_LIMIT");
    }

    // 检查文件大小（1MB）
    if (buffer.length > 1 * 1024 * 1024) {
      throw new BusinessException("FILE_TOO_LARGE");
    }

    // 检查文件类型
    const allowedTypes = [".jpg", ".jpeg", ".png", ".webp"];
    const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
    if (!allowedTypes.includes(ext)) {
      throw new BusinessException("INVALID_FILE_TYPE");
    }

    // 上传文件
    if (!this.ossService.isConfigured()) {
      throw new BusinessException("SERVICE_UNAVAILABLE");
    }

    // 获取用户当前头像信息
    const user = await this.findById(userId);

    // 使用 FileCategory 枚举生成新 Key
    const newKey = this.ossService.generateKey(FileCategory.AVATAR, filename);

    // 使用 replaceFile 原子操作替换头像
    const result = await this.ossService.replaceFile(
      user?.avatarKey || null,
      newKey,
      buffer,
      {
        headers: {
          "Content-Type": this.getContentType(ext),
        },
      },
    );

    if (!result) {
      throw new BusinessException("INTERNAL_ERROR");
    }

    // 更新用户头像 URL 和 Key
    await this.userRepository.update(userId, {
      avatar: result.url,
      avatarKey: result.key,
    });

    // 增加上传计数
    await this.redisService.incrementAvatarUpload(userId);

    return result.url;
  }

  /**
   * 发送邮箱验证邮件
   */
  async sendEmailVerification(userId: string, email: string): Promise<void> {
    const user = await this.findById(userId);
    if (!user) {
      throw new BusinessException("USER_NOT_FOUND");
    }

    if (!this.mailService.isConfigured()) {
      throw new BusinessException("SERVICE_UNAVAILABLE");
    }

    // 生成验证令牌
    const token = uuidv4();
    await this.redisService.setEmailVerifyToken(userId, token);

    // 发送验证邮件
    const sent = await this.mailService.sendVerificationEmail(email, token);
    if (!sent) {
      throw new BusinessException("INTERNAL_ERROR");
    }
  }

  /**
   * 验证邮箱
   */
  async verifyEmail(token: string): Promise<void> {
    const userId = await this.redisService.getEmailVerifyToken(token);
    if (!userId) {
      throw new BusinessException("INVALID_EMAIL_TOKEN");
    }

    // 更新用户邮箱验证状态
    await this.userRepository.update(userId, { emailVerified: true });

    // 删除验证令牌
    await this.redisService.deleteEmailVerifyToken(token);
  }

  /**
   * 发送修改邮箱验证码
   */
  async sendChangeEmailCode(userId: string, newEmail: string): Promise<void> {
    const user = await this.findById(userId);
    if (!user) {
      throw new BusinessException("USER_NOT_FOUND");
    }

    // 检查新邮箱是否与当前邮箱相同
    if (newEmail === user.email) {
      throw new BusinessException("SAME_EMAIL");
    }

    // 检查新邮箱是否已被使用
    const existingUser = await this.findByEmail(newEmail);
    if (existingUser) {
      throw new BusinessException("EMAIL_ALREADY_EXISTS");
    }

    if (!this.mailService.isConfigured()) {
      throw new BusinessException("SERVICE_UNAVAILABLE");
    }

    // 检查冷却时间
    const inCooldown = await this.redisService.checkEmailCooldown(userId);
    if (inCooldown) {
      throw new BusinessException("VERIFICATION_CODE_TOO_FREQUENT");
    }

    // 检查日限制
    const dailyCount = await this.redisService.getEmailDailyCount(newEmail);
    if (dailyCount >= 10) {
      throw new BusinessException("VERIFICATION_CODE_DAILY_LIMIT");
    }

    // 生成6位数字验证码
    const code = Math.random().toString().slice(2, 8);

    // 存储验证码
    await this.redisService.setEmailCode(userId, newEmail, code);

    // 发送验证码邮件
    const sent = await this.mailService.sendVerificationCodeEmail(
      newEmail,
      code,
    );
    if (!sent) {
      // 发送失败，删除验证码
      await this.redisService.deleteEmailCode(userId, newEmail);
      throw new BusinessException("INTERNAL_ERROR");
    }

    // 设置冷却时间和日计数
    await this.redisService.setEmailCooldown(userId);
    await this.redisService.incrementEmailDailyCount(newEmail);
  }

  /**
   * 修改邮箱
   */
  async changeEmail(
    userId: string,
    newEmail: string,
    code: string,
  ): Promise<void> {
    const user = await this.findById(userId);
    if (!user) {
      throw new BusinessException("USER_NOT_FOUND");
    }

    // 检查是否与当前邮箱相同
    if (newEmail === user.email) {
      throw new BusinessException("SAME_EMAIL");
    }

    // 检查新邮箱是否已被使用
    const existingUser = await this.findByEmail(newEmail);
    if (existingUser) {
      throw new BusinessException("EMAIL_ALREADY_EXISTS");
    }

    // 获取存储的验证码
    const storedCode = await this.redisService.getEmailCode(userId, newEmail);
    if (!storedCode) {
      throw new BusinessException("VERIFICATION_CODE_EXPIRED");
    }

    // 验证验证码
    if (storedCode !== code) {
      throw new BusinessException("INVALID_VERIFICATION_CODE");
    }

    // 更新邮箱
    await this.userRepository.update(userId, {
      email: newEmail,
      emailVerified: true, // 验证码验证通过后直接标记为已验证
    });

    // 删除验证码
    await this.redisService.deleteEmailCode(userId, newEmail);
  }

  /**
   * 发送短信验证码
   */
  async sendSmsCode(
    phone: string,
    type: "register" | "login" | "reset_password" | "change_phone",
  ): Promise<void> {
    // 检查冷却时间
    const inCooldown = await this.redisService.checkSmsCooldown(phone, type);
    if (inCooldown) {
      throw new BusinessException("VERIFICATION_CODE_TOO_FREQUENT");
    }

    // 检查日限制
    const dailyCount = await this.redisService.getSmsDailyCount(phone);
    if (dailyCount >= 10) {
      throw new BusinessException("VERIFICATION_CODE_DAILY_LIMIT");
    }

    // 生成验证码
    const code = Math.random().toString().slice(2, 8);

    // 存储验证码
    await this.redisService.setSmsCode(phone, type, code);

    // 发送验证码
    const sent = await this.smsService.sendVerificationCode(phone, code, type);
    if (!sent) {
      // 发送失败，删除验证码
      await this.redisService.deleteSmsCode(phone, type);
      throw new BusinessException("SERVICE_UNAVAILABLE");
    }

    // 设置冷却时间和日计数
    await this.redisService.setSmsCooldown(phone, type);
    await this.redisService.incrementSmsDailyCount(phone);
  }

  /**
   * 验证短信验证码
   */
  async verifySmsCode(
    phone: string,
    type: "register" | "login" | "reset_password" | "change_phone",
    code: string,
  ): Promise<void> {
    // 检查失败次数
    const failCount = await this.redisService.getSmsVerifyFail(phone);
    if (failCount >= 5) {
      throw new BusinessException("VERIFICATION_CODE_MAX_ATTEMPTS");
    }

    // 获取验证码
    const storedCode = await this.redisService.getSmsCode(phone, type);
    if (!storedCode) {
      throw new BusinessException("VERIFICATION_CODE_EXPIRED");
    }

    // 验证
    if (storedCode !== code) {
      // 增加失败次数
      await this.redisService.incrSmsVerifyFail(phone);
      throw new BusinessException("INVALID_VERIFICATION_CODE");
    }

    // 验证成功，清除验证码和失败次数
    await this.redisService.deleteSmsCode(phone, type);
    await this.redisService.clearSmsVerifyFail(phone);
  }

  /**
   * 获取用户默认模型配置
   */
  async getDefaultModels(
    userId: string,
  ): Promise<Record<string, string | null>> {
    const user = await this.findById(userId);
    if (!user) {
      throw new BusinessException("USER_NOT_FOUND");
    }
    // 返回用户配置，空字符串表示使用系统默认
    const configs = user.defaultModels || {};
    return {
      TEXT_GENERATION: configs.TEXT_GENERATION || "",
      IMAGE_GENERATION: configs.IMAGE_GENERATION || "",
      VIDEO_GENERATION: configs.VIDEO_GENERATION || "",
      AUDIO_GENERATION: configs.AUDIO_GENERATION || "",
      LIP_SYNC: configs.LIP_SYNC || "",
    };
  }

  /**
   * 更新用户默认模型配置
   */
  async updateDefaultModels(
    userId: string,
    configs: Record<string, string | null>,
  ): Promise<Record<string, string | null>> {
    const user = await this.findById(userId);
    if (!user) {
      throw new BusinessException("USER_NOT_FOUND");
    }

    // 验证配置中的模型ID（如果提供的话）
    const validConfigs: Record<string, string | null> = {};
    for (const [category, modelId] of Object.entries(configs)) {
      // null 或空字符串表示使用系统默认
      if (modelId === null || modelId === "") {
        validConfigs[category] = null;
      } else {
        // 模型ID可以是任意字符串（如 "qwen2.5-72b"）
        validConfigs[category] = modelId;
      }
    }

    // 合并现有配置和新配置
    const currentModels = user.defaultModels || {};
    const mergedConfigs = { ...currentModels, ...validConfigs };

    await this.userRepository.update(userId, { defaultModels: mergedConfigs });
    return validConfigs;
  }

  /**
   * 更新用户订阅状态（订阅等级和过期时间）
   * @param userId 用户ID
   * @param tier 订阅等级
   * @param expiresAt 过期时间
   */
  async updateSubscriptionStatus(
    userId: string,
    tier: string,
    expiresAt: Date | null,
  ): Promise<void> {
    await this.userRepository.update(userId, {
      subscriptionTier: tier,
      subscriptionExpiresAt: expiresAt,
    });
  }

  /**
   * 转换为 UserResponseDto
   */
  toResponseDto(user: User): UserResponseDto {
    return {
      id: user.id,
      username: user.username,
      phone: user.phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2"),
      email: user.email,
      emailVerified: user.emailVerified,
      avatar: user.avatar,
      bio: user.bio,
      perms: user.perms,
      subscriptionTier: user.subscriptionTier,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
      balance: Number(user.balance),
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }

  private getContentType(ext: string): string {
    const map: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
    };
    return map[ext] || "application/octet-stream";
  }
}
