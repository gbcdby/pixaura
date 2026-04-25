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
import { PropImage } from "./prop-image.entity";

export const PropStatus = {
  DRAFT: "draft",
  ACTIVE: "active",
  ARCHIVED: "archived",
} as const;

export type PropStatusType = (typeof PropStatus)[keyof typeof PropStatus];

export const PropImportance = {
  KEY: "key",
  SECONDARY: "secondary",
  BACKGROUND: "background",
} as const;

export type PropImportanceType =
  (typeof PropImportance)[keyof typeof PropImportance];

/**
 * 外观属性
 */
export interface PropAppearance {
  color?: string;
  material?: string;
  size?: "tiny" | "small" | "medium" | "large" | "huge";
  condition?: "new" | "worn" | "damaged" | "ancient";
  distinctiveFeatures?: string[];
}

/**
 * 剧本关联信息
 */
export interface PropScriptRef {
  scriptId: string;
  extractedAt: string;
  sceneIds: string[];
}

/**
 * 跨项目导入信息
 */
export interface PropImportInfo {
  sourceProjectId: string;
  sourcePropId: string;
  importedAt: string;
}

/**
 * 道具实体
 * 存储道具档案和基础信息
 */
@Entity("props")
export class Prop {
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
    comment: "道具名称（项目内唯一）",
  })
  name: string;

  @Column({
    type: "text",
    nullable: true,
    comment: "道具描述",
  })
  description: string | null;

  @Column({
    type: "jsonb",
    nullable: true,
    comment:
      "外观细节（color, material, size, condition, distinctive_features）",
  })
  appearance: PropAppearance | null;

  @Column({
    type: "varchar",
    length: 200,
    nullable: true,
    comment: "道具功能/用途",
  })
  function: string | null;

  @Column({
    type: "varchar",
    length: 20,
    default: PropImportance.BACKGROUND,
    comment: "重要性：key/secondary/background",
  })
  importance: PropImportanceType;

  @Column({
    type: "varchar",
    length: 20,
    default: PropStatus.DRAFT,
    comment: "状态：draft/active/archived",
  })
  status: PropStatusType;

  @Column({
    name: "script_ref",
    type: "jsonb",
    nullable: true,
    comment: "剧本关联信息（script_id, extracted_at, scene_ids）",
  })
  scriptRef: PropScriptRef | null;

  @Column({
    name: "import_info",
    type: "jsonb",
    nullable: true,
    comment: "跨项目导入信息",
  })
  importInfo: PropImportInfo | null;

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

  @OneToMany(() => PropImage, (image) => image.prop)
  images: PropImage[];
}
