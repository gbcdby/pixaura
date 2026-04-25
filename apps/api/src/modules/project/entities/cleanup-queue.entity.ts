import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Project } from "./project.entity";

export type ResourceType =
  | "project"
  | "character"
  | "scene"
  | "prop"
  | "script"
  | "storyboard";
export type CleanupAction = "delete" | "archive";
export type CleanupStatus = "pending" | "processing" | "completed" | "failed";

/**
 * 资源清理队列实体
 * 存储需要异步清理的项目资源
 */
@Entity("cleanup_queue")
export class CleanupQueue {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    name: "resource_type",
    type: "varchar",
    length: 50,
    comment: "资源类型：project/character/scene/prop/script/storyboard",
  })
  resourceType: ResourceType;

  @Column({
    name: "resource_id",
    type: "varchar",
    length: 50,
    comment: "资源ID",
  })
  resourceId: string;

  @Column({
    name: "project_id",
    type: "varchar",
    length: 50,
    comment: "所属项目ID",
  })
  projectId: string;

  @ManyToOne(() => Project, { onDelete: "CASCADE" })
  @JoinColumn({ name: "project_id", referencedColumnName: "projectId" })
  project: Project;

  @Column({
    type: "varchar",
    length: 20,
    comment: "操作类型：delete/archive",
  })
  action: CleanupAction;

  @Column({
    type: "varchar",
    length: 20,
    default: "pending",
    comment: "状态：pending/processing/completed/failed",
  })
  status: CleanupStatus;

  @Column({
    name: "retry_count",
    type: "integer",
    default: 0,
    comment: "重试次数",
  })
  retryCount: number;

  @Column({
    name: "scheduled_at",
    type: "timestamp",
    comment: "计划执行时间（软删除30天后）",
  })
  scheduledAt: Date;

  @Column({
    name: "processed_at",
    type: "timestamp",
    nullable: true,
    comment: "实际处理时间",
  })
  processedAt: Date | null;

  @Column({
    name: "error_message",
    type: "text",
    nullable: true,
    comment: "错误信息（失败时记录）",
  })
  errorMessage: string | null;

  @CreateDateColumn({
    name: "created_at",
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt: Date;

  /**
   * 检查任务是否可以执行
   */
  canProcess(): boolean {
    const now = new Date();
    return (
      (this.status === "pending" || this.status === "failed") &&
      this.scheduledAt <= now &&
      this.retryCount < 3
    );
  }
}
