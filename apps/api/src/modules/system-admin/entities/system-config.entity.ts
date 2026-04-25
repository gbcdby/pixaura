import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "../../user/entities/user.entity";

/**
 * 系统配置实体
 * 存储系统全局配置项
 */
@Entity("system_config")
export class SystemConfig {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    type: "varchar",
    length: 100,
    name: "config_key",
    unique: true,
    comment: "配置键",
  })
  configKey: string;

  @Column({
    type: "jsonb",
    name: "config_value",
    comment: "配置值（JSON格式）",
  })
  configValue: Record<string, unknown>;

  @Column({
    type: "varchar",
    length: 255,
    nullable: true,
    comment: "配置说明",
  })
  description: string | null;

  @Column({ type: "uuid", name: "updated_by", nullable: true })
  updatedBy: string | null;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  // 关联关系
  @ManyToOne(() => User, { onDelete: "SET NULL" })
  @JoinColumn({ name: "updated_by" })
  updater: User;
}
