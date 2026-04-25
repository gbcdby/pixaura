import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { User } from "../../user/entities/user.entity";
import { Collaborator } from "./collaborator.entity";
import { ProjectModelConfig } from "./project-model-config.entity";
import { ProjectInviteLink } from "./project-invite-link.entity";

export const ProjectStatus = {
  DRAFT: "draft",
  ACTIVE: "active",
  COMPLETED: "completed",
  ARCHIVED: "archived",
} as const;

export type ProjectStatusType =
  (typeof ProjectStatus)[keyof typeof ProjectStatus];

/**
 * 项目实体
 * 存储项目基础信息
 */
@Entity("project")
export class Project {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    name: "project_id",
    type: "varchar",
    length: 50,
    unique: true,
    comment: "项目唯一标识，如：proj_abc123",
  })
  projectId: string;

  @Column({
    type: "varchar",
    length: 100,
    comment: "项目名称（2-50字符）",
  })
  name: string;

  @Column({
    type: "text",
    nullable: true,
    comment: "项目描述（最多500字符）",
  })
  description: string | null;

  @Column({
    name: "cover_url",
    type: "varchar",
    length: 500,
    nullable: true,
    comment: "封面图URL",
  })
  coverUrl: string | null;

  @Column({
    name: "owner_id",
    type: "uuid",
    comment: "所有者用户ID",
  })
  ownerId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "owner_id" })
  owner: User;

  @Column({
    type: "varchar",
    length: 20,
    default: ProjectStatus.DRAFT,
    comment: "状态：draft/active/completed/archived",
  })
  status: ProjectStatusType;

  @Column({
    name: "previous_status",
    type: "varchar",
    length: 20,
    nullable: true,
    comment: "归档前的状态，用于恢复",
  })
  previousStatus: ProjectStatusType | null;

  @VersionColumn({
    name: "version",
    default: 1,
    comment: "乐观锁版本号",
  })
  version: number;

  @Column({
    name: "is_deleted",
    type: "boolean",
    default: false,
    comment: "是否软删除",
  })
  isDeleted: boolean;

  @Column({
    name: "deleted_at",
    type: "timestamp",
    nullable: true,
    comment: "删除时间",
  })
  deletedAt: Date | null;

  @Column({
    name: "deleted_by",
    type: "uuid",
    nullable: true,
    comment: "删除操作者ID",
  })
  deletedBy: string | null;

  @ManyToOne(() => User, { onDelete: "SET NULL" })
  @JoinColumn({ name: "deleted_by" })
  deletedByUser: User | null;

  @CreateDateColumn({
    name: "created_at",
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: "updated_at",
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP",
  })
  updatedAt: Date;

  // 关联关系
  @OneToMany(() => Collaborator, (collaborator) => collaborator.project)
  collaborators: Collaborator[];

  @OneToMany(() => ProjectModelConfig, (config) => config.project)
  modelConfigs: ProjectModelConfig[];

  @OneToMany(() => ProjectInviteLink, (link) => link.project)
  inviteLinks: ProjectInviteLink[];
}
