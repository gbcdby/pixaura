import { EntityRepository, Repository } from "typeorm";
import { TtsInstructionTemplateEntity } from "../entities/instruction-template.entity";

@EntityRepository(TtsInstructionTemplateEntity)
export class TtsInstructionTemplateRepository extends Repository<TtsInstructionTemplateEntity> {
  /**
   * 获取所有启用的模板
   */
  async findActive(): Promise<TtsInstructionTemplateEntity[]> {
    return this.find({
      where: { isActive: true },
      order: { category: "ASC", createdAt: "ASC" },
    });
  }

  /**
   * 按分类获取模板
   */
  async findByCategory(
    category: string,
  ): Promise<TtsInstructionTemplateEntity[]> {
    return this.find({
      where: { category, isActive: true },
      order: { createdAt: "ASC" },
    });
  }

  /**
   * 获取系统模板
   */
  async findSystem(): Promise<TtsInstructionTemplateEntity[]> {
    return this.find({
      where: { isSystem: true, isActive: true },
      order: { category: "ASC", createdAt: "ASC" },
    });
  }
}
