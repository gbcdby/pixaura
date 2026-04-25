import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { ProjectTemplateService } from "../services/project-template.service";
import { ProjectGuard, OwnerGuard, EditorGuard } from "../guards";
import {
  SaveAsTemplateSchema,
  CreateFromTemplateSchema,
  QueryTemplatesSchema,
  type SaveAsTemplateDto,
  type CreateFromTemplateDto,
  type QueryTemplatesDto,
} from "../dto";

type RequestWithUser = FastifyRequest & { user: { userId: string } };

/**
 * 项目模板控制器
 * 处理模板相关的 HTTP 请求
 */
@Controller("project-templates")
@UseGuards(JwtAuthGuard)
export class ProjectTemplateController {
  constructor(private readonly templateService: ProjectTemplateService) {}

  /**
   * 获取模板列表
   */
  @Get()
  async getTemplates(
    @Req() req: RequestWithUser,
    @Query(new ZodValidationPipe(QueryTemplatesSchema))
    query: QueryTemplatesDto,
  ) {
    const { list, total } = await this.templateService.findTemplates(
      req.user.userId,
      query,
    );

    return {
      list: list.map((t) => ({
        id: t.templateId,
        name: t.name,
        description: t.description,
        type: t.type,
        creator: t.creator
          ? { id: t.creator.id, username: t.creator.username }
          : { id: null, username: "系统" },
        tags: t.tags,
        usageCount: t.usageCount,
        isPublic: t.isPublic,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  /**
   * 获取模板详情
   */
  @Get(":template_id")
  async getTemplateDetail(
    @Req() req: RequestWithUser,
    @Param("template_id") templateId: string,
  ) {
    const template = await this.templateService.findTemplateById(
      templateId,
      req.user.userId,
    );

    return {
      id: template.templateId,
      name: template.name,
      description: template.description,
      type: template.type,
      creator: template.creator
        ? { id: template.creator.id, username: template.creator.username }
        : { id: null, username: "系统" },
      content: template.content,
      modelConfigs: template.modelConfigs,
      tags: template.tags,
      usageCount: template.usageCount,
      isPublic: template.isPublic,
      status: template.status,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }

  /**
   * 保存项目为模板
   */
  @Post("projects/:project_id/save-as-template")
  @UseGuards(ProjectGuard, EditorGuard)
  async saveAsTemplate(
    @Req() req: RequestWithUser,
    @Param("project_id") projectId: string,
    @Body(new ZodValidationPipe(SaveAsTemplateSchema)) dto: SaveAsTemplateDto,
  ) {
    const template = await this.templateService.saveAsTemplate(
      projectId,
      req.user.userId,
      dto,
    );

    return {
      id: template.templateId,
      name: template.name,
      type: template.type,
      createdAt: template.createdAt,
    };
  }

  /**
   * 从模板创建项目
   */
  @Post(":template_id/create-project")
  async createProjectFromTemplate(
    @Req() req: RequestWithUser,
    @Param("template_id") templateId: string,
    @Body(new ZodValidationPipe(CreateFromTemplateSchema))
    dto: CreateFromTemplateDto,
  ) {
    const result = await this.templateService.createFromTemplate(
      templateId,
      req.user.userId,
      dto,
    );

    return {
      projectId: result.projectId,
      name: result.name,
      status: result.status,
      imported: result.imported,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * 更新模板
   */
  @Put(":template_id")
  async updateTemplate(
    @Req() req: RequestWithUser,
    @Param("template_id") templateId: string,
    @Body() dto: Partial<SaveAsTemplateDto>,
  ) {
    const template = await this.templateService.updateTemplate(
      templateId,
      req.user.userId,
      dto,
    );

    return {
      id: template.templateId,
      name: template.name,
      updatedAt: template.updatedAt,
    };
  }

  /**
   * 删除模板
   */
  @Delete(":template_id")
  async deleteTemplate(
    @Req() req: RequestWithUser,
    @Param("template_id") templateId: string,
  ) {
    await this.templateService.deleteTemplate(templateId, req.user.userId);

    return null;
  }
}
