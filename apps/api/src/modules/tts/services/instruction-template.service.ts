/**
 * TTS 指令模板服务
 */
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TtsInstructionTemplateEntity } from "../entities/instruction-template.entity";

export interface TtsInstructionTemplateDto {
  id: string;
  name: string;
  description?: string;
  category?: string;
  content: string;
  isSystem: boolean;
  isActive: boolean;
}

@Injectable()
export class TtsInstructionTemplateService {
  constructor(
    @InjectRepository(TtsInstructionTemplateEntity)
    private readonly templateRepository: Repository<TtsInstructionTemplateEntity>,
  ) {}

  /**
   * 获取所有启用的模板
   */
  async findAll(): Promise<TtsInstructionTemplateDto[]> {
    const entities = await this.templateRepository.find({
      where: { isActive: true },
      order: { category: "ASC", name: "ASC" },
    });

    return entities.map(this.toDto);
  }

  /**
   * 获取所有模板（包括禁用的，管理端使用）
   */
  async findAllIncludingInactive(): Promise<TtsInstructionTemplateDto[]> {
    const entities = await this.templateRepository.find({
      order: { category: "ASC", name: "ASC" },
    });

    return entities.map(this.toDto);
  }

  /**
   * 按分类获取模板
   */
  async findByCategory(category: string): Promise<TtsInstructionTemplateDto[]> {
    const entities = await this.templateRepository.find({
      where: { isActive: true, category },
      order: { name: "ASC" },
    });

    return entities.map(this.toDto);
  }

  /**
   * 获取单个模板
   */
  async findById(id: string): Promise<TtsInstructionTemplateDto | null> {
    const entity = await this.templateRepository.findOne({
      where: { id },
    });

    return entity ? this.toDto(entity) : null;
  }

  /**
   * 创建模板
   */
  async create(
    data: Partial<TtsInstructionTemplateEntity>,
  ): Promise<TtsInstructionTemplateDto> {
    const entity = this.templateRepository.create(data);
    const saved = await this.templateRepository.save(entity);
    return this.toDto(saved);
  }

  /**
   * 更新模板
   */
  async update(
    id: string,
    data: Partial<TtsInstructionTemplateEntity>,
  ): Promise<TtsInstructionTemplateDto | null> {
    await this.templateRepository.update(id, data);
    const entity = await this.templateRepository.findOne({ where: { id } });
    return entity ? this.toDto(entity) : null;
  }

  /**
   * 删除模板（系统模板不可删除）
   */
  async remove(id: string): Promise<{ success: boolean; message?: string }> {
    const entity = await this.templateRepository.findOne({ where: { id } });
    if (!entity) {
      return { success: false, message: "模板不存在" };
    }
    if (entity.isSystem) {
      return { success: false, message: "系统模板不可删除" };
    }
    await this.templateRepository.delete(id);
    return { success: true };
  }

  /**
   * 转换为 DTO
   */
  private toDto(
    entity: TtsInstructionTemplateEntity,
  ): TtsInstructionTemplateDto {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description ?? undefined,
      category: entity.category ?? undefined,
      content: entity.content,
      isSystem: entity.isSystem,
      isActive: entity.isActive,
    };
  }
}
