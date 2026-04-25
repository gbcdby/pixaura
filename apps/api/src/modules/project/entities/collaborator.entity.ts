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
import { Project } from "./project.entity";

export const CollaboratorRole = {
  OWNER: "owner",
  EDITOR: "editor",
  VIEWER: "viewer",
} as const;

export type CollaboratorRoleType =
  (typeof CollaboratorRole)[keyof typeof CollaboratorRole];

/**
 * 协作者关联实体
 * 存储项目与用户的协作关系
 */
@Entity("collaborator")
export class Collaborator {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    name: "project_id",
    type: "varchar",
    length: 50,
    comment: "项目ID",
  })
  projectId: string;

  @ManyToOne(() => Project, (project) => project.collaborators, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "project_id", referencedColumnName: "projectId" })
  project: Project;

  @Column({
    name: "user_id",
    type: "uuid",
    comment: "用户ID",
  })
  userId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({
    type: "varchar",
    length: 20,
    comment: "角色：owner/editor/viewer",
  })
  role: CollaboratorRoleType;

  @Column({
    name: "invited_by",
    type: "uuid",
    comment: "邀请人ID",
  })
  invitedBy: string;

  @ManyToOne(() => User, { onDelete: "SET NULL" })
  @JoinColumn({ name: "invited_by" })
  invitedByUser: User;

  @CreateDateColumn({
    name: "joined_at",
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP",
    comment: "加入时间",
  })
  joinedAt: Date;

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
}
