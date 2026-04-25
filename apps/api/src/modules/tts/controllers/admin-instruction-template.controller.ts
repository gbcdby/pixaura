/**
 * TTS 指令模板管理控制器（管理后台）
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { AdminAuthGuard } from "../../model-config/guards/admin-auth.guard";
import {
  TtsInstructionTemplateService,
  TtsInstructionTemplateDto,
} from "../services/instruction-template.service";
import {
  CreateTtsInstructionTemplateDto,
  UpdateTtsInstructionTemplateDto,
} from "@pixaura/shared-types";

@ApiTags("TTS 管理 - 指令模板")
@Controller("/admin/tts/instruction-templates")
@UseGuards(JwtAuthGuard, AdminAuthGuard)
@ApiBearerAuth()
export class AdminTtsInstructionTemplateController {
  constructor(
    private readonly templateService: TtsInstructionTemplateService,
  ) {}

  /**
   * 获取所有模板（包括禁用的）
   * GET /api/admin/tts/instruction-templates
   */
  @Get()
  @ApiOperation({ summary: "获取所有指令模板（管理端）" })
  async findAll(): Promise<{ templates: TtsInstructionTemplateDto[] }> {
    const templates = await this.templateService.findAllIncludingInactive();
    return { templates };
  }

  /**
   * 创建模板
   * POST /api/admin/tts/instruction-templates
   */
  @Post()
  @ApiOperation({ summary: "创建指令模板" })
  async create(
    @Body() dto: CreateTtsInstructionTemplateDto,
  ): Promise<{ template: TtsInstructionTemplateDto }> {
    const template = await this.templateService.create({
      name: dto.name,
      description: dto.description,
      category: dto.category,
      content: dto.content,
      isSystem: dto.isSystem ?? false,
      isActive: dto.isActive ?? true,
    });
    return { template };
  }

  /**
   * 更新模板
   * PATCH /api/admin/tts/instruction-templates/:id
   */
  @Patch(":id")
  @ApiOperation({ summary: "更新指令模板" })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateTtsInstructionTemplateDto,
  ): Promise<{ template: TtsInstructionTemplateDto }> {
    const template = await this.templateService.update(id, {
      name: dto.name,
      description: dto.description,
      category: dto.category,
      content: dto.content,
      isActive: dto.isActive,
    });
    if (!template) {
      throw new Error("模板不存在");
    }
    return { template };
  }

  /**
   * 删除模板（系统模板不可删除）
   * DELETE /api/admin/tts/instruction-templates/:id
   */
  @Delete(":id")
  @ApiOperation({ summary: "删除指令模板" })
  async remove(
    @Param("id") id: string,
  ): Promise<{ success: boolean; message?: string }> {
    const result = await this.templateService.remove(id);
    if (!result.success && result.message === "系统模板不可删除") {
      throw new ForbiddenException(result.message);
    }
    return result;
  }
}
