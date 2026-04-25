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

export const TemplateType = {
  SYSTEM: "system",
  USER: "user",
} as const;
export type TemplateType = (typeof TemplateType)[keyof typeof TemplateType];

export const TemplateStatus = {
  ENABLED: "enabled",
  DISABLED: "disabled",
} as const;
export type TemplateStatus =
  (typeof TemplateStatus)[keyof typeof TemplateStatus];

/**
 * 模板角色
 */
export interface TemplateCharacter {
  name: string;
  description?: string;
  personality?: string;
  age?: string;
  gender?: string;
  importance: "protagonist" | "supporting" | "minor";
  referenceImageUrl?: string;
}

/**
 * 模板场景
 */
export interface TemplateScene {
  name: string;
  description?: string;
  atmosphere?: string;
  timeOfDay?: string;
  location?: string;
  referenceImageUrl?: string;
}

/**
 * 模板道具
 */
export interface TemplateProp {
  name: string;
  description?: string;
  category?: string;
  referenceImageUrl?: string;
}

/**
 * 场大纲
 */
export interface SceneOutline {
  number: number;
  title: string;
  setting: {
    time: string;
    location: string;
    atmosphere: string;
  };
  characters: string[];
  summary: string;
}

/**
 * 幕大纲
 */
export interface ActOutline {
  number: number;
  title: string;
  summary: string;
  scenes: SceneOutline[];
}

/**
 * 剧本大纲
 */
export interface ScriptOutline {
  title: string;
  genre?: string;
  tone?: string;
  targetDuration?: number;
  summary: string;
  acts: ActOutline[];
}

/**
 * 模板内容结构
 */
export interface TemplateContent {
  characters?: TemplateCharacter[];
  scenes?: TemplateScene[];
  props?: TemplateProp[];
  scriptOutline?: ScriptOutline;
}

/**
 * 模板模型配置
 */
export interface TemplateModelConfigs {
  TEXT_GENERATION?: string;
  IMAGE_GENERATION?: string;
  VIDEO_GENERATION?: string;
  AUDIO_GENERATION?: string;
}

/**
 * 项目模板实体
 * 存储项目模板信息
 */
@Entity("project_template")
export class ProjectTemplate {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    name: "template_id",
    type: "varchar",
    length: 50,
    unique: true,
    comment: "模板唯一标识",
  })
  templateId: string;

  @Column({
    type: "varchar",
    length: 100,
    comment: "模板名称",
  })
  name: string;

  @Column({
    type: "text",
    nullable: true,
    comment: "模板描述",
  })
  description: string | null;

  @Column({
    type: "varchar",
    length: 20,
    comment: "类型：system/user",
  })
  type: TemplateType;

  @Column({
    name: "creator_id",
    type: "uuid",
    nullable: true,
    comment: "创建者ID，系统模板为NULL",
  })
  creatorId: string | null;

  @ManyToOne(() => User, { onDelete: "SET NULL" })
  @JoinColumn({ name: "creator_id" })
  creator: User | null;

  @Column({
    type: "jsonb",
    comment: "模板内容（角色、场景、剧本大纲等）",
  })
  content: TemplateContent;

  @Column({
    name: "model_configs",
    type: "jsonb",
    nullable: true,
    comment: "默认模型配置",
  })
  modelConfigs: TemplateModelConfigs | null;

  @Column({
    type: "jsonb",
    default: [],
    comment: "标签列表",
  })
  tags: string[];

  @Column({
    name: "usage_count",
    type: "integer",
    default: 0,
    comment: "使用次数",
  })
  usageCount: number;

  @Column({
    name: "is_public",
    type: "boolean",
    default: false,
    comment: "是否公开（仅用户模板有效）",
  })
  isPublic: boolean;

  @Column({
    type: "varchar",
    length: 20,
    default: "enabled",
    comment: "状态：enabled/disabled",
  })
  status: TemplateStatus;

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
