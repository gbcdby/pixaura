import { EntityRepository, Repository } from "typeorm";
import { TtsVoiceEntity } from "../entities/voice.entity";

@EntityRepository(TtsVoiceEntity)
export class TtsVoiceRepository extends Repository<TtsVoiceEntity> {
  /**
   * 获取所有启用的音色
   */
  async findActive(): Promise<TtsVoiceEntity[]> {
    return this.find({
      where: { isActive: true },
      order: { sortOrder: "ASC", createdAt: "ASC" },
    });
  }

  /**
   * 按性别获取音色
   */
  async findByGender(gender: string): Promise<TtsVoiceEntity[]> {
    return this.find({
      where: { gender, isActive: true },
      order: { sortOrder: "ASC", createdAt: "ASC" },
    });
  }

  /**
   * 按 voiceId 查找音色
   */
  async findByVoiceId(voiceId: string): Promise<TtsVoiceEntity | null> {
    return this.findOne({
      where: { voiceId },
    });
  }
}
