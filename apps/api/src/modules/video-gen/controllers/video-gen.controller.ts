import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Request,
  UseGuards,
  ParseUUIDPipe,
  Query,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { ProjectGuard } from "../../project/guards/project.guard";
import { VideoGenService, VideoGenQuotaService } from "../services";
import {
  CreateVideoGenTaskSchema,
  CreateBatchVideoGenSchema,
  RetryVideoGenTaskSchema,
  GetQuotaRecordsSchema,
  CreateVideoGenTaskDto,
  CreateBatchVideoGenDto,
  RetryVideoGenTaskDto,
  GetQuotaRecordsDto,
} from "../dto";

@ApiTags("视频生成")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class VideoGenController {
  constructor(
    private readonly videoGenService: VideoGenService,
    private readonly videoGenQuotaService: VideoGenQuotaService,
  ) {}

  @ApiOperation({ summary: "提交视频生成任务" })
  @Post("projects/:projectId/video-gen/tasks")
  @UseGuards(ProjectGuard)
  async createTask(
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(CreateVideoGenTaskSchema))
    dto: CreateVideoGenTaskDto,
    @Request() req: { user: { userId: string } },
  ) {
    return {
      code: 0,
      data: await this.videoGenService.createTask(req.user.userId, dto),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  @ApiOperation({ summary: "批量提交视频生成任务" })
  @Post("projects/:projectId/video-gen/tasks/batch")
  @UseGuards(ProjectGuard)
  async createBatchTasks(
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(CreateBatchVideoGenSchema))
    dto: CreateBatchVideoGenDto,
    @Request() req: { user: { userId: string } },
  ) {
    return {
      code: 0,
      data: await this.videoGenService.createBatchTasks(req.user.userId, dto),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  @ApiOperation({ summary: "获取任务详情" })
  @Get("video-gen/tasks/:taskId")
  async findById(
    @Param("taskId", ParseUUIDPipe) taskId: string,
    @Request() req: { user: { userId: string } },
  ) {
    return {
      code: 0,
      data: await this.videoGenService.findById(taskId, req.user.userId),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  @ApiOperation({ summary: "取消任务" })
  @Patch("video-gen/tasks/:taskId/cancel")
  async cancelTask(
    @Param("taskId", ParseUUIDPipe) taskId: string,
    @Request() req: { user: { userId: string } },
  ) {
    return {
      code: 0,
      data: await this.videoGenService.cancelTask(taskId, req.user.userId),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  @ApiOperation({ summary: "重试任务" })
  @Patch("video-gen/tasks/:taskId/retry")
  async retryTask(
    @Param("taskId", ParseUUIDPipe) taskId: string,
    @Body(new ZodValidationPipe(RetryVideoGenTaskSchema))
    dto: RetryVideoGenTaskDto,
    @Request() req: { user: { userId: string } },
  ) {
    return {
      code: 0,
      data: await this.videoGenService.retryTask(taskId, req.user.userId, dto),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  @ApiOperation({ summary: "获取项目的进行中的任务" })
  @Get("projects/:projectId/video-gen/active-tasks")
  @UseGuards(ProjectGuard)
  async findActiveTasks(@Param("projectId") projectId: string) {
    return {
      code: 0,
      data: await this.videoGenService.findActiveTasksByProject(projectId),
      msg: "success",
      timestamp: Date.now(),
    };
  }

  @ApiOperation({ summary: "获取额度扣减记录" })
  @Get("video-gen/quota-records")
  async getQuotaRecords(
    @Query(new ZodValidationPipe(GetQuotaRecordsSchema))
    query: GetQuotaRecordsDto,
    @Request() req: { user: { userId: string } },
  ) {
    const result = await this.videoGenQuotaService.findRecords(
      req.user.userId,
      {
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
        status: query.status,
        page: query.page,
        pageSize: query.pageSize,
      },
    );

    return {
      code: 0,
      data: {
        items: result.items.map((record) => ({
          id: record.id,
          taskId: record.taskId,
          type:
            record.status === "refunded"
              ? ("refund" as const)
              : ("deduct" as const),
          amount: record.estimatedAmount,
          status: record.status,
          deductedFrom: record.deductedFrom,
          createdAt: record.createdAt.toISOString(),
          completedAt:
            record.confirmedAt?.toISOString() ||
            record.refundedAt?.toISOString(),
        })),
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      },
      msg: "success",
      timestamp: Date.now(),
    };
  }
}
