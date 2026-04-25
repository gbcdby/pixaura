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
import { CharacterImage } from "./character-image.entity";

export const CharacterStatus = {
  DRAFT: "draft",
  ACTIVE: "active",
  ARCHIVED: "archived",
} as const;

export type CharacterStatusType =
  (typeof CharacterStatus)[keyof typeof CharacterStatus];

export const CharacterImportance = {
  PROTAGONIST: "protagonist",
  SUPPORTING: "supporting",
  MINOR: "minor",
} as const;

export type CharacterImportanceType =
  (typeof CharacterImportance)[keyof typeof CharacterImportance];

export const CharacterGender = {
  MALE: "male",
  FEMALE: "female",
  OTHER: "other",
  UNKNOWN: "unknown",
} as const;

export type CharacterGenderType =
  (typeof CharacterGender)[keyof typeof CharacterGender];

/**
 * 外观细节
 */
export interface CharacterAppearance {
  height?: string;
  bodyType?: string;
  hairColor?: string;
  hairStyle?: string;
  eyeColor?: string;
  skinTone?: string;
  clothingStyle?: string;
  distinctiveFeatures?: string[];
}

/**
 * 剧本关联信息
 */
export interface ScriptRef {
  scriptId: string;
  extractedAt: string;
  importance: CharacterImportanceType;
}

/**
 * 跨项目导入信息
 */
export interface ImportInfo {
  sourceProjectId: string;
  sourceCharacterId: string;
  importedAt: string;
}

/**
 * 角色实体
 * 存储角色档案和基础信息
 */
@Entity("characters")
export class Character {
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
    comment: "角色名称（项目内唯一）",
  })
  name: string;

  @Column({
    type: "text",
    nullable: true,
    comment: "角色描述（外貌、性格等）",
  })
  description: string | null;

  @Column({
    type: "varchar",
    length: 500,
    nullable: true,
    comment: "性格特征",
  })
  personality: string | null;

  @Column({
    type: "varchar",
    length: 20,
    nullable: true,
    comment: "年龄描述",
  })
  age: string | null;

  @Column({
    type: "varchar",
    length: 10,
    nullable: true,
    comment: "性别：male/female/other/unknown",
  })
  gender: CharacterGenderType | null;

  @Column({
    type: "varchar",
    length: 50,
    nullable: true,
    comment: "职业",
  })
  occupation: string | null;

  @Column({
    type: "text",
    nullable: true,
    comment: "背景故事",
  })
  background: string | null;

  @Column({
    type: "jsonb",
    nullable: true,
    comment: "外观细节（身高、体型、发色、眼色等）",
  })
  appearance: CharacterAppearance | null;

  @Column({
    type: "varchar",
    length: 20,
    default: CharacterImportance.MINOR,
    comment: "重要性：protagonist/supporting/minor",
  })
  importance: CharacterImportanceType;

  @Column({
    type: "varchar",
    length: 20,
    default: CharacterStatus.DRAFT,
    comment: "状态：draft/active/archived",
  })
  status: CharacterStatusType;

  @Column({
    name: "script_ref",
    type: "jsonb",
    nullable: true,
    comment: "剧本关联信息（script_id, extracted_at, importance）",
  })
  scriptRef: ScriptRef | null;

  @Column({
    name: "import_info",
    type: "jsonb",
    nullable: true,
    comment: "跨项目导入信息",
  })
  importInfo: ImportInfo | null;

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

  @OneToMany(() => CharacterImage, (image) => image.character)
  images: CharacterImage[];
}
