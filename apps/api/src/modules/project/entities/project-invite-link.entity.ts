import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "../../user/entities/user.entity";
import { Project } from "./project.entity";

export type InviteRole = "editor" | "viewer";

/**
 * 项目邀请链接实体
 * 存储项目的邀请链接信息
 */
@Entity("project_invite_link")
export class ProjectInviteLink {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    name: "project_id",
    type: "varchar",
    length: 50,
    comment: "项目ID",
  })
  projectId: string;

  @ManyToOne(() => Project, (project) => project.inviteLinks, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "project_id", referencedColumnName: "projectId" })
  project: Project;

  @Column({
    name: "invite_code",
    type: "varchar",
    length: 32,
    unique: true,
    comment: "邀请码",
  })
  inviteCode: string;

  @Column({
    type: "varchar",
    length: 20,
    comment: "邀请角色：editor/viewer",
  })
  role: InviteRole;

  @Column({
    name: "max_uses",
    type: "integer",
    default: 1,
    comment: "最大使用次数",
  })
  maxUses: number;

  @Column({
    name: "used_count",
    type: "integer",
    default: 0,
    comment: "已使用次数",
  })
  usedCount: number;

  @Column({
    name: "expires_at",
    type: "timestamp",
    comment: "过期时间",
  })
  expiresAt: Date;

  @Column({
    name: "revoked_at",
    type: "timestamp",
    nullable: true,
    comment: "撤销时间",
  })
  revokedAt: Date | null;

  @Column({
    name: "created_by",
    type: "uuid",
    comment: "创建者ID",
  })
  createdBy: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "created_by" })
  creator: User;

  @CreateDateColumn({
    name: "created_at",
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt: Date;

  /**
   * 检查邀请链接是否有效
   */
  isValid(): boolean {
    const now = new Date();
    return (
      !this.revokedAt && this.expiresAt > now && this.usedCount < this.maxUses
    );
  }
}
