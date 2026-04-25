import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Character } from "./character.entity";

export const CharacterImageType = {
  FRONT_VIEW: "front_view",
  SIDE_VIEW: "side_view",
  BACK_VIEW: "back_view",
  ANGLE_VIEW: "angle_view",
  ADDITIONAL: "additional",
} as const;

export type CharacterImageTypeType =
  (typeof CharacterImageType)[keyof typeof CharacterImageType];

/**
 * 生成信息
 */
export interface GenerationInfo {
  generationId: string;
  prompt: string;
  negativePrompt?: string;
  modelId: string;
  seed?: number;
  createdAt: string;
}

/**
 * 上传信息
 */
export interface UploadInfo {
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
}

/**
 * 角色图片实体
 * 存储角色的参考图像（四视图等）
 */
@Entity("character_images")
export class CharacterImage {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    name: "character_id",
    type: "uuid",
    comment: "关联角色ID",
  })
  characterId: string;

  @ManyToOne(() => Character, (character) => character.images, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "character_id" })
  character: Character;

  @Column({
    type: "varchar",
    length: 20,
    comment: "图片类型：front_view/side_view/back_view/angle_view/additional",
  })
  type: CharacterImageTypeType;

  @Column({
    type: "varchar",
    length: 500,
    comment: "图片URL",
  })
  url: string;

  @Column({
    name: "thumbnail_url",
    type: "varchar",
    length: 500,
    nullable: true,
    comment: "缩略图URL",
  })
  thumbnailUrl: string | null;

  @Column({
    name: "generation_info",
    type: "jsonb",
    nullable: true,
    comment: "生成信息（prompt, negative_prompt, model_id, seed, created_at）",
  })
  generationInfo: GenerationInfo | null;

  @Column({
    name: "upload_info",
    type: "jsonb",
    nullable: true,
    comment: "上传信息（original_filename, file_size, mime_type, uploaded_at）",
  })
  uploadInfo: UploadInfo | null;

  @Column({
    type: "integer",
    default: 1,
    comment: "版本号",
  })
  version: number;

  @Column({
    name: "is_current",
    type: "boolean",
    default: true,
    comment: "是否为当前版本",
  })
  isCurrent: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
