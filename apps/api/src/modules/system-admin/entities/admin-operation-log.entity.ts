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
 * 管理员操作日志实体
 * 记录管理员的所有操作，用于审计
 */
@Entity("admin_operation_log")
export class AdminOperationLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "admin_id" })
  adminId: string;

  @Column({
    type: "varchar",
    length: 50,
    name: "operation_type",
    comment: "操作类型：user_ban, user_unban, config_update, balance_adjust 等",
  })
  operationType: string;

  @Column({
    type: "varchar",
    length: 20,
    name: "target_type",
    nullable: true,
    comment: "操作对象类型：user, config, billing 等",
  })
  targetType: string | null;

  @Column({
    type: "uuid",
    name: "target_id",
    nullable: true,
    comment: "操作对象ID",
  })
  targetId: string | null;

  @Column({
    type: "jsonb",
    comment: "操作详情（变更前后的值）",
  })
  details: Record<string, unknown>;

  @Column({
    type: "inet",
    name: "ip_address",
    comment: "操作者IP",
  })
  ipAddress: string;

  @Column({
    type: "varchar",
    length: 500,
    name: "user_agent",
    nullable: true,
    comment: "浏览器UA",
  })
  userAgent: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  // 关联关系
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "admin_id" })
  admin: User;
}
