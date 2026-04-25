/**
 * TTS 指令模板控制器
 */
import { Controller, Get, Param } from "@nestjs/common";
import {
  TtsInstructionTemplateService,
  TtsInstructionTemplateDto,
} from "../services/instruction-template.service";

@Controller("tts")
export class TtsInstructionTemplateController {
  constructor(
    private readonly templateService: TtsInstructionTemplateService,
  ) {}

  /**
   * 获取所有指令模板
   * GET /api/tts/instruction-templates
   */
  @Get("instruction-templates")
  async findAll(): Promise<TtsInstructionTemplateDto[]> {
    return this.templateService.findAll();
  }

  /**
   * 按分类获取模板
   * GET /api/tts/instruction-templates/by-category/:category
   */
  @Get("instruction-templates/by-category/:category")
  async findByCategory(
    @Param("category") category: string,
  ): Promise<TtsInstructionTemplateDto[]> {
    return this.templateService.findByCategory(category);
  }

  /**
   * 获取单个模板
   * GET /api/tts/instruction-templates/:id
   */
  @Get("instruction-templates/:id")
  async findById(
    @Param("id") id: string,
  ): Promise<TtsInstructionTemplateDto | null> {
    return this.templateService.findById(id);
  }
}
