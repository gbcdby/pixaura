import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Scene } from "./scene.entity";

export const SceneImageType = {
  PANORAMA: "panorama",
  WIDE_SHOT: "wide_shot",
  DETAIL: "detail",
  VARIANT: "variant",
  ADDITIONAL: "additional",
} as const;

export type SceneImageTypeType =
  (typeof SceneImageType)[keyof typeof SceneImageType];

export const VariantType = {
  TIME_OF_DAY: "time_of_day",
  WEATHER: "weather",
} as const;

export type VariantTypeType = (typeof VariantType)[keyof typeof VariantType];

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
 * 场景图片实体
 * 存储场景的参考图像（全景图、广角、细节等）
 */
@Entity("scene_images")
export class SceneImage {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    name: "scene_id",
    type: "uuid",
    comment: "关联场景ID",
  })
  sceneId: string;

  @ManyToOne(() => Scene, (scene) => scene.images, { onDelete: "CASCADE" })
  @JoinColumn({ name: "scene_id" })
  scene: Scene;

  @Column({
    type: "varchar",
    length: 20,
    comment: "图片类型：panorama/wide_shot/detail/variant/additional",
  })
  type: SceneImageTypeType;

  @Column({
    name: "variant_type",
    type: "varchar",
    length: 20,
    nullable: true,
    comment: "变体类型：time_of_day/weather",
  })
  variantType: VariantTypeType | null;

  @Column({
    name: "variant_value",
    type: "varchar",
    length: 20,
    nullable: true,
    comment: "变体值",
  })
  variantValue: string | null;

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
