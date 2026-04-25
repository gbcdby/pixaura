import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("users")
@Index(["username"], { unique: true })
@Index(["phone"], { unique: true })
@Index(["email"], { unique: true, where: "email IS NOT NULL" })
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 20, unique: true })
  username: string;

  @Column({ type: "varchar", length: 11, unique: true })
  phone: string;

  @Column({ type: "varchar", length: 255, nullable: true, unique: true })
  email: string | null;

  @Column({ name: "email_verified", type: "boolean", default: false })
  emailVerified: boolean;

  @Column({ name: "password_hash", type: "varchar", length: 255 })
  passwordHash: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  avatar: string | null;

  @Column({ name: "avatar_key", type: "varchar", length: 255, nullable: true })
  avatarKey: string | null;

  @Column({ type: "text", nullable: true })
  bio: string | null;

  @Column({ type: "int", default: 0 })
  perms: number;

  @Column({
    name: "subscription_tier",
    type: "varchar",
    length: 20,
    default: "free",
  })
  subscriptionTier: string;

  @Column({
    name: "subscription_expires_at",
    type: "timestamp",
    nullable: true,
  })
  subscriptionExpiresAt: Date | null;

  @Column({ name: "subscription_quota", type: "jsonb", default: {} })
  subscriptionQuota: Record<string, unknown>;

  @Column({ name: "default_models", type: "jsonb", default: {} })
  defaultModels: Record<string, string | null>;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  balance: number;

  @Column({
    name: "balance_limit",
    type: "decimal",
    precision: 10,
    scale: 2,
    default: 0,
  })
  balanceLimit: number;

  @Column({ name: "is_banned", type: "boolean", default: false })
  isBanned: boolean;

  @Column({ name: "banned_reason", type: "text", nullable: true })
  bannedReason: string | null;

  @Column({ name: "banned_at", type: "timestamp", nullable: true })
  bannedAt: Date | null;

  @Column({ name: "phone_changed_at", type: "timestamp", nullable: true })
  phoneChangedAt: Date | null;

  @Column({ name: "last_login_at", type: "timestamp", nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
