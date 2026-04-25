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
import { SceneImage } from "./scene-image.entity";

export const SceneStatus = {
  DRAFT: "draft",
  ACTIVE: "active",
  ARCHIVED: "archived",
} as const;

export type SceneStatusType = (typeof SceneStatus)[keyof typeof SceneStatus];

export const SceneType = {
  INTERIOR: "interior",
  EXTERIOR: "exterior",
  BOTH: "both",
} as const;

export type SceneTypeType = (typeof SceneType)[keyof typeof SceneType];

/**
 * 空间属性
 */
export interface SceneSpace {
  size?: "small" | "medium" | "large" | "huge";
  layout?: string;
  keyAreas?: string[];
}

/**
 * 视觉属性
 */
export interface SceneVisuals {
  primaryColor?: string;
  lighting?: "natural" | "artificial" | "mixed";
  lightingMood?: "bright" | "dim" | "dramatic" | "soft";
}

/**
 * 氛围属性
 */
export interface SceneAtmosphere {
  timeOfDay?: "dawn" | "morning" | "noon" | "afternoon" | "dusk" | "night";
  weather?: "sunny" | "cloudy" | "rainy" | "snowy" | "foggy" | "stormy";
  mood?: string;
}

/**
 * 剧本关联信息
 */
export interface SceneScriptRef {
  scriptId: string;
  extractedAt: string;
}

/**
 * 跨项目导入信息
 */
export interface SceneImportInfo {
  sourceProjectId: string;
  sourceSceneId: string;
  importedAt: string;
}

/**
 * 场景实体
 * 存储场景档案和基础信息
 */
@Entity("scenes")
export class Scene {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    name: "project_id",
    type: "varchar",
    length: 50,
    comment: "所属项目ID",
  })
  projectId: string;

  @Column({
    type: "varchar",
    length: 100,
    comment: "场景名称（项目内唯一）",
  })
  name: string;

  @Column({
    type: "text",
    nullable: true,
    comment: "场景描述",
  })
  description: string | null;

  @Column({
    type: "varchar",
    length: 20,
    default: SceneType.INTERIOR,
    comment: "场景类型：interior/exterior/both",
  })
  type: SceneTypeType;

  @Column({
    type: "jsonb",
    nullable: true,
    comment: "空间属性（size, layout, key_areas）",
  })
  space: SceneSpace | null;

  @Column({
    type: "jsonb",
    nullable: true,
    comment: "视觉属性（primary_color, lighting, lighting_mood）",
  })
  visuals: SceneVisuals | null;

  @Column({
    type: "jsonb",
    nullable: true,
    comment: "氛围属性（time_of_day, weather, mood）",
  })
  atmosphere: SceneAtmosphere | null;

  @Column({
    type: "varchar",
    length: 20,
    default: SceneStatus.DRAFT,
    comment: "状态：draft/active/archived",
  })
  status: SceneStatusType;

  @Column({
    name: "script_ref",
    type: "jsonb",
    nullable: true,
    comment: "剧本关联信息（script_id, extracted_at）",
  })
  scriptRef: SceneScriptRef | null;

  @Column({
    name: "import_info",
    type: "jsonb",
    nullable: true,
    comment: "跨项目导入信息",
  })
  importInfo: SceneImportInfo | null;

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

  @OneToMany(() => SceneImage, (image) => image.scene)
  images: SceneImage[];
}
