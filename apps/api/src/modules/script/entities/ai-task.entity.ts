import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "../../user/entities/user.entity";
import { Script } from "./script.entity";

export const AITaskType = {
  GENERATE: "generate",
  PARSE: "parse",
  CONTINUE: "continue",
  REWRITE: "rewrite",
  EXPAND: "expand",
  CONDENSE: "condense",
} as const;

export type AITaskTypeType = (typeof AITaskType)[keyof typeof AITaskType];

export const AITaskStatus = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type AITaskStatusType = (typeof AITaskStatus)[keyof typeof AITaskStatus];

/**
 * AI 任务实体
 * 存储 AI 生成任务的配置和结果
 */
@Entity("ai_tasks")
export class AITask {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    name: "script_id",
    type: "uuid",
    comment: "关联剧本ID",
  })
  scriptId: string;

  @ManyToOne(() => Script, (script) => script.aiTasks, { onDelete: "CASCADE" })
  @JoinColumn({ name: "script_id" })
  script: Script;

  @Column({
    type: "varchar",
    length: 20,
    comment: "任务类型：generate/continue/rewrite/expand/condense",
  })
  type: AITaskTypeType;

  @Column({
    type: "varchar",
    length: 20,
    default: AITaskStatus.PENDING,
    comment: "状态：pending/processing/completed/failed/cancelled",
  })
  status: AITaskStatusType;

  @Column({
    type: "jsonb",
    comment: "任务配置参数",
  })
  config: Record<string, unknown>;

  @Column({
    type: "jsonb",
    nullable: true,
    comment: "任务结果",
  })
  result: Record<string, unknown> | null;

  @Column({
    type: "text",
    nullable: true,
    comment: "错误信息",
  })
  error: string | null;

  @Column({
    type: "int",
    nullable: true,
    comment: "进度 0-100（流式输出时更新）",
  })
  progress: number | null;

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

  @Column({
    name: "started_at",
    type: "timestamp",
    nullable: true,
    comment: "开始处理时间",
  })
  startedAt: Date | null;

  @Column({
    name: "completed_at",
    type: "timestamp",
    nullable: true,
    comment: "完成时间",
  })
  completedAt: Date | null;
}
