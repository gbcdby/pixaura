import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "../../user/entities/user.entity";

/**
 * 用户封禁记录实体
 * 记录用户封禁历史
 */
@Entity("user_ban_record")
export class UserBanRecord {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    type: "uuid",
    name: "user_id",
    comment: "被封禁用户ID",
  })
  userId: string;

  @Column({
    type: "uuid",
    name: "banned_by",
    comment: "操作管理员ID",
  })
  bannedBy: string;

  @Column({
    type: "varchar",
    length: 255,
    comment: "封禁原因",
  })
  reason: string;

  @Column({
    type: "int",
    name: "duration_days",
    comment: "封禁时长（-1表示永久）",
  })
  durationDays: number;

  @CreateDateColumn({ name: "banned_at" })
  bannedAt: Date;

  @Column({
    type: "uuid",
    name: "unbanned_by",
    nullable: true,
    comment: "解封操作人",
  })
  unbannedBy: string | null;

  @Column({
    type: "timestamp",
    name: "unbanned_at",
    nullable: true,
    comment: "解封时间",
  })
  unbannedAt: Date | null;

  @Column({
    type: "varchar",
    length: 255,
    name: "unban_reason",
    nullable: true,
    comment: "解封原因",
  })
  unbanReason: string | null;

  // 关联关系
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @ManyToOne(() => User, { onDelete: "SET NULL" })
  @JoinColumn({ name: "banned_by" })
  bannedByUser: User;

  @ManyToOne(() => User, { onDelete: "SET NULL" })
  @JoinColumn({ name: "unbanned_by" })
  unbannedByUser: User;
}
