import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "../../user/entities/user.entity";

export type NoticeType = "maintenance" | "feature" | "important" | "other";
export type NoticePriority = "high" | "medium" | "low";
export type NoticeStatus = "draft" | "published" | "unpublished";

/**
 * 系统公告实体
 * 存储系统公告信息
 */
@Entity("system_notices")
@Index(["status", "startAt", "endAt"])
@Index(["priority", "startAt"])
export class SystemNotice {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 200 })
  title: string;

  @Column({ type: "text" })
  content: string;

  @Column({
    type: "enum",
    enum: ["maintenance", "feature", "important", "other"],
    default: "other",
  })
  type: NoticeType;

  @Column({
    type: "enum",
    enum: ["high", "medium", "low"],
    default: "medium",
  })
  priority: NoticePriority;

  @Column({
    type: "enum",
    enum: ["draft", "published", "unpublished"],
    default: "draft",
  })
  status: NoticeStatus;

  @Column({ name: "start_at", type: "timestamp" })
  startAt: Date;

  @Column({ name: "end_at", type: "timestamp", nullable: true })
  endAt: Date | null;

  @Column({ name: "is_top", type: "boolean", default: false })
  isTop: boolean;

  @Column({ name: "view_count", type: "int", default: 0 })
  viewCount: number;

  @Column({ name: "created_by", type: "uuid" })
  createdBy: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @DeleteDateColumn({ name: "deleted_at" })
  deletedAt: Date | null;

  // 关联关系
  @ManyToOne(() => User, { onDelete: "SET NULL" })
  @JoinColumn({ name: "created_by" })
  creator: User;
}
