/**
 * 管理员用户种子数据
 */

import { DataSource } from "typeorm";
import * as argon2 from "argon2";
import { User } from "../../../modules/user/entities/user.entity";

export async function seedAdminUser(dataSource: DataSource): Promise<void> {
  const userRepo = dataSource.getRepository(User);

  const existing = await userRepo.findOne({
    where: { username: "admin" },
  });

  if (existing) {
    console.log(`  ↷ 跳过已存在的管理员用户: admin`);
    return;
  }

  const passwordHash = await argon2.hash("admin123");

  const admin = userRepo.create({
    username: "admin",
    phone: "13800138000",
    passwordHash,
    email: null,
    emailVerified: false,
    avatar: null,
    bio: null,
    perms: 3, // SUPER_ADMIN = ADMIN_PANEL | ADMIN_MANAGEMENT
    subscriptionTier: "free",
    balance: 0,
    isBanned: false,
  });

  await userRepo.save(admin);
  console.log(`  ✓ 创建超级管理员用户: admin`);
}
