import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { User } from "../../user/entities/user.entity";
import { AITask } from "./ai-task.entity";
import { AssetCrossProjectRef } from "./asset-cross-project-ref.entity";

export const ScriptStatus = {
  DRAFT: "draft",
  EDITING: "editing",
  AI_GENERATING: "ai_generating",
  CONFIRMED: "confirmed",
} as const;

export type ScriptStatusType = (typeof ScriptStatus)[keyof typeof ScriptStatus];

/**
 * 剧本实体
 * 存储剧本基础信息和内容
 */
@Entity("scripts")
export class Script {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    name: "project_id",
    type: "varchar",
    length: 50,
    comment: "所属项目ID",
  })
  projectId: string;

  /**
   * 乐观锁版本号
   * 用于防止并发更新导致的数据覆盖
   * TypeORM 会自动在更新时检查版本号
   */
  @Column({
    type: "int",
    default: 0,
    comment: "乐观锁版本号",
  })
  version: number;

  @Column({
    type: "varchar",
    length: 100,
    comment: "剧本标题",
  })
  title: string;

  @Column({
    type: "text",
    nullable: true,
    comment: "剧本描述",
  })
  description: string | null;

  @Column({
    type: "varchar",
    length: 20,
    default: ScriptStatus.DRAFT,
    comment: "状态：draft/editing/ai_generating/confirmed",
  })
  status: ScriptStatusType;

  @Column({
    type: "jsonb",
    comment: "剧本内容（acts, characters, scenes, props, summary）",
  })
  content: Record<string, unknown>;

  @Column({
    type: "jsonb",
    comment: "元数据（genre, tone, word_count, asset_summary 等）",
  })
  metadata: Record<string, unknown>;

  @Column({
    name: "confirmed_at",
    type: "timestamp",
    nullable: true,
    comment: "确认时间",
  })
  confirmedAt: Date | null;

  @Column({
    name: "created_by",
    type: "uuid",
    comment: "创建者用户ID",
  })
  createdBy: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "created_by" })
  creator: User;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @DeleteDateColumn({ name: "deleted_at" })
  deletedAt: Date | null;

  @OneToMany(() => AITask, (task) => task.script)
  aiTasks: AITask[];

  @OneToMany(() => AssetCrossProjectRef, (ref) => ref.script)
  crossProjectRefs: AssetCrossProjectRef[];
}
