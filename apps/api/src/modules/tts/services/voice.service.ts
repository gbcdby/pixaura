/**
 * TTS 音色服务
 */
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TtsVoiceEntity } from "../entities/voice.entity";

export interface TtsVoiceDto {
  id: string;
  voiceId: string;
  name: string;
  gender: string;
  category?: string;
  style?: string;
  previewAudioUrl?: string;
  isActive: boolean;
  sortOrder: number;
}

@Injectable()
export class TtsVoiceService {
  constructor(
    @InjectRepository(TtsVoiceEntity)
    private readonly voiceRepository: Repository<TtsVoiceEntity>,
  ) {}

  /**
   * 获取所有启用的音色
   */
  async findAll(): Promise<TtsVoiceDto[]> {
    const entities = await this.voiceRepository.find({
      where: { isActive: true },
      order: { sortOrder: "ASC", name: "ASC" },
    });

    return entities.map(this.toDto);
  }

  /**
   * 获取所有音色（包括禁用的，管理端使用）
   */
  async findAllIncludingInactive(): Promise<TtsVoiceDto[]> {
    const entities = await this.voiceRepository.find({
      order: { sortOrder: "ASC", name: "ASC" },
    });

    return entities.map(this.toDto);
  }

  /**
   * 按性别获取音色
   */
  async findByGender(gender: string): Promise<TtsVoiceDto[]> {
    const entities = await this.voiceRepository.find({
      where: { isActive: true, gender },
      order: { sortOrder: "ASC", name: "ASC" },
    });

    return entities.map(this.toDto);
  }

  /**
   * 按分类获取音色
   */
  async findByCategory(category: string): Promise<TtsVoiceDto[]> {
    const entities = await this.voiceRepository.find({
      where: { isActive: true, category },
      order: { sortOrder: "ASC", name: "ASC" },
    });

    return entities.map(this.toDto);
  }

  /**
   * 获取单个音色（通过 voiceId）
   */
  async findByVoiceId(voiceId: string): Promise<TtsVoiceDto | null> {
    const entity = await this.voiceRepository.findOne({
      where: { voiceId },
    });

    return entity ? this.toDto(entity) : null;
  }

  /**
   * 获取单个音色（通过数据库 id）
   */
  async findById(id: string): Promise<TtsVoiceDto | null> {
    const entity = await this.voiceRepository.findOne({
      where: { id },
    });

    return entity ? this.toDto(entity) : null;
  }

  /**
   * 代理获取预览音频（解决跨域问题）
   */
  async fetchPreviewAudio(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("获取音频失败，请稍后重试");
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * 创建音色
   */
  async create(data: Partial<TtsVoiceEntity>): Promise<TtsVoiceDto> {
    const entity = this.voiceRepository.create(data);
    const saved = await this.voiceRepository.save(entity);
    return this.toDto(saved);
  }

  /**
   * 更新音色
   */
  async update(
    id: string,
    data: Partial<TtsVoiceEntity>,
  ): Promise<TtsVoiceDto | null> {
    await this.voiceRepository.update(id, data);
    const entity = await this.voiceRepository.findOne({ where: { id } });
    return entity ? this.toDto(entity) : null;
  }

  /**
   * 删除音色
   */
  async remove(id: string): Promise<boolean> {
    const result = await this.voiceRepository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  /**
   * 切换启用状态
   */
  async toggleActive(id: string): Promise<TtsVoiceDto | null> {
    const entity = await this.voiceRepository.findOne({ where: { id } });
    if (!entity) return null;

    entity.isActive = !entity.isActive;
    const saved = await this.voiceRepository.save(entity);
    return this.toDto(saved);
  }

  /**
   * 转换为 DTO
   */
  private toDto(entity: TtsVoiceEntity): TtsVoiceDto {
    return {
      id: entity.id,
      voiceId: entity.voiceId,
      name: entity.name,
      gender: entity.gender,
      category: entity.category ?? undefined,
      style: entity.style ?? undefined,
      previewAudioUrl: entity.previewAudioUrl ?? undefined,
      isActive: entity.isActive,
      sortOrder: entity.sortOrder,
    };
  }
}
