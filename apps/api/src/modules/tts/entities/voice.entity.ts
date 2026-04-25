/**
 * TTS 音色实体
 * 存储千问 TTS 音色信息
 */
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("tts_voice")
export class TtsVoiceEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index({ unique: true })
  @Column({
    name: "voice_id",
    length: 100,
    comment: "千问 TTS 音色 ID，如 Cherry, Ethan",
  })
  voiceId: string;

  @Column({ length: 100, comment: "显示名称，如 芊悦, 晨煦" })
  name: string;

  @Column({ type: "varchar", length: 20, comment: "性别：female, male, child" })
  gender: string;

  @Column({
    type: "varchar",
    length: 50,
    nullable: true,
    comment: "分类：standard, dialect",
  })
  category: string | null;

  @Column({ type: "varchar", length: 100, nullable: true, comment: "风格描述" })
  style: string | null;

  @Column({
    name: "preview_audio_url",
    type: "text",
    nullable: true,
    comment: "试听音频 URL",
  })
  previewAudioUrl: string | null;

  @Column({ name: "is_active", default: true, comment: "是否启用" })
  isActive: boolean;

  @Column({ name: "sort_order", default: 0, comment: "排序" })
  sortOrder: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
