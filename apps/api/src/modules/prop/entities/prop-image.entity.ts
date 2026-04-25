import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Prop } from "./prop.entity";

export const PropImageType = {
  FRONT_VIEW: "front_view",
  SIDE_VIEW: "side_view",
  TOP_VIEW: "top_view",
  ADDITIONAL: "additional",
} as const;

export type PropImageTypeType =
  (typeof PropImageType)[keyof typeof PropImageType];

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
 * 道具图片实体
 * 存储道具的三视图参考图像
 */
@Entity("prop_images")
export class PropImage {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    name: "prop_id",
    type: "uuid",
    comment: "关联道具ID",
  })
  propId: string;

  @ManyToOne(() => Prop, (prop) => prop.images, { onDelete: "CASCADE" })
  @JoinColumn({ name: "prop_id" })
  prop: Prop;

  @Column({
    type: "varchar",
    length: 20,
    comment: "图片类型：front_view/side_view/top_view/additional",
  })
  type: PropImageTypeType;

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
