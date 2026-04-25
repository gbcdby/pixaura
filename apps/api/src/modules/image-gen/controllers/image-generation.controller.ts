/**
 * 图片生成 Controller
 * 对外接口：文生图、图生图、批量生成、任务管理
 */
import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { ImageGenerationService } from "../services";
import {
  CreateImageGenerationTaskSchema,
  CreateBatchImageGenSchema,
  RegenerateImageSchema,
  CreateImageGenerationTaskDto,
  CreateBatchImageGenDto,
  RegenerateImageDto,
  ImageGenTaskStatus,
} from "@pixaura/shared-types";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";

interface RequestWithUser extends Request {
  user: {
    userId: string;
    email: string;
  };
}

@ApiTags("图片生成")
@Controller("image-gen")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ImageGenerationController {
  constructor(private imageGenService: ImageGenerationService) {}

  /**
   * 提交图像生成任务
   * 统一接口：当 config.referenceImageUrl 存在时使用图生图逻辑，否则使用文生图逻辑
   */
  @Post("generate")
  @ApiOperation({
    summary: "提交图像生成任务",
    description:
      "统一接口：当 config.referenceImageUrl 存在时使用图生图逻辑，否则使用文生图逻辑",
  })
  async createImageGeneration(
    @Body(new ZodValidationPipe(CreateImageGenerationTaskSchema))
    dto: CreateImageGenerationTaskDto,
    @Request() req: RequestWithUser,
  ) {
    const result = await this.imageGenService.createImageGenerationTask(
      req.user.userId,
      dto,
    );
    return {
      code: 0,
      data: result,
      msg: "success",
    };
  }

  /**
   * @deprecated 使用 POST /generate 替代
   * 提交文生图任务
   */
  @Post("text-to-image")
  @ApiOperation({
    summary: "提交文生图任务（已废弃）",
    description: "请使用 POST /generate 接口",
  })
  async createTextToImage(
    @Body(new ZodValidationPipe(CreateImageGenerationTaskSchema))
    dto: CreateImageGenerationTaskDto,
    @Request() req: RequestWithUser,
  ) {
    const result = await this.imageGenService.createImageGenerationTask(
      req.user.userId,
      dto,
    );
    return {
      code: 0,
      data: result,
      msg: "success",
    };
  }

  /**
   * @deprecated 使用 POST /generate 替代
   * 提交图生图任务
   */
  @Post("image-to-image")
  @ApiOperation({
    summary: "提交图生图任务（已废弃）",
    description: "请使用 POST /generate 接口",
  })
  async createImageToImage(
    @Body(new ZodValidationPipe(CreateImageGenerationTaskSchema))
    dto: CreateImageGenerationTaskDto,
    @Request() req: RequestWithUser,
  ) {
    const result = await this.imageGenService.createImageGenerationTask(
      req.user.userId,
      dto,
    );
    return {
      code: 0,
      data: result,
      msg: "success",
    };
  }

  /**
   * 提交批量生成任务
   */
  @Post("batch")
  @ApiOperation({ summary: "提交批量生成任务" })
  async createBatch(
    @Body(new ZodValidationPipe(CreateBatchImageGenSchema))
    dto: CreateBatchImageGenDto,
    @Request() req: RequestWithUser,
  ) {
    const result = await this.imageGenService.createBatchTask(
      req.user.userId,
      dto,
    );
    return {
      code: 0,
      data: result,
      msg: "success",
    };
  }

  /**
   * 获取任务列表
   */
  @Get("tasks")
  @ApiOperation({ summary: "获取项目的图片生成任务列表" })
  @ApiQuery({ name: "projectId", required: true, description: "项目ID" })
  @ApiQuery({ name: "status", required: false, description: "任务状态过滤" })
  @ApiQuery({ name: "page", required: false, description: "页码" })
  @ApiQuery({ name: "limit", required: false, description: "每页数量" })
  async getTaskList(
    @Query("projectId") projectId: string,
    @Query("status") status: ImageGenTaskStatus,
    @Query("page") page: string,
    @Query("limit") limit: string,
    @Request() req: RequestWithUser,
  ) {
    const result = await this.imageGenService.getTaskList(
      projectId,
      req.user.userId,
      {
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
        status,
      },
    );
    return {
      code: 0,
      data: result,
      msg: "success",
    };
  }

  /**
   * 获取任务详情
   */
  @Get("tasks/:id")
  @ApiOperation({ summary: "获取图片生成任务详情" })
  @ApiParam({ name: "id", description: "任务ID" })
  async getTaskDetail(
    @Param("id") taskId: string,
    @Request() req: RequestWithUser,
  ) {
    const result = await this.imageGenService.getTaskDetail(
      taskId,
      req.user.userId,
    );
    return {
      code: 0,
      data: result,
      msg: "success",
    };
  }

  /**
   * 取消任务
   */
  @Post("tasks/:id/cancel")
  @ApiOperation({ summary: "取消图片生成任务" })
  @ApiParam({ name: "id", description: "任务ID" })
  async cancelTask(
    @Param("id") taskId: string,
    @Request() req: RequestWithUser,
  ) {
    const result = await this.imageGenService.cancelTask(
      taskId,
      req.user.userId,
    );
    return {
      code: 0,
      data: result,
      msg: "success",
    };
  }

  /**
   * 删除任务
   */
  @Delete("tasks/:id")
  @ApiOperation({ summary: "删除图片生成任务" })
  @ApiParam({ name: "id", description: "任务ID" })
  async deleteTask(
    @Param("id") taskId: string,
    @Request() req: RequestWithUser,
  ) {
    // 软删除实现
    const task = await this.imageGenService.getTaskDetail(
      taskId,
      req.user.userId,
    );
    // TODO: 实现软删除
    return {
      code: 0,
      data: { taskId },
      msg: "success",
    };
  }

  /**
   * 重新生成单张图片
   */
  @Post("results/:id/regenerate")
  @ApiOperation({ summary: "重新生成单张图片" })
  @ApiParam({ name: "id", description: "结果ID" })
  async regenerateImage(
    @Param("id") resultId: string,
    @Body(new ZodValidationPipe(RegenerateImageSchema)) dto: RegenerateImageDto,
    @Request() req: RequestWithUser,
  ) {
    const result = await this.imageGenService.regenerateImage(
      resultId,
      req.user.userId,
      dto,
    );
    return {
      code: 0,
      data: result,
      msg: "success",
    };
  }
}
