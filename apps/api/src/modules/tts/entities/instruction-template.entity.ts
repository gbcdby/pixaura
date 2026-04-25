/**
 * TTS 指令模板实体
 * 存储预设的 TTS 指令模板
 */
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("tts_instruction_template")
export class TtsInstructionTemplateEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 200, comment: "模板名称" })
  name: string;

  @Column({ type: "text", nullable: true, comment: "模板描述" })
  description: string | null;

  @Column({
    type: "varchar",
    length: 50,
    nullable: true,
    comment: "分类：emotion, style, scene, speed",
  })
  category: string | null;

  @Column({ type: "text", comment: "指令内容" })
  content: string;

  @Column({
    name: "is_system",
    default: false,
    comment: "是否系统模板（不可删除）",
  })
  isSystem: boolean;

  @Column({ name: "is_active", default: true, comment: "是否启用" })
  isActive: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
