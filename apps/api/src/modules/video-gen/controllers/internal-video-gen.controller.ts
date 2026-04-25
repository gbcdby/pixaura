import { Controller, Post, Body } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { VideoGenService } from "../services/video-gen.service";
import {
  InternalCreateVideoGenSchema,
  InternalBatchCreateVideoGenSchema,
  InternalCreateVideoGenDto,
  InternalBatchCreateVideoGenDto,
} from "../dto";

@ApiTags("内部接口 - 视频生成")
@Controller("internal")
export class InternalVideoGenController {
  constructor(private readonly videoGenService: VideoGenService) {}

  @ApiOperation({ summary: "生成分镜视频（内部接口）" })
  @Post("video-gen/shot")
  async createTask(
    @Body(new ZodValidationPipe(InternalCreateVideoGenSchema))
    dto: InternalCreateVideoGenDto,
  ) {
    // 内部接口使用系统用户ID
    const systemUserId = "system";

    const result = await this.videoGenService.createTask(systemUserId, {
      projectId: dto.projectId,
      shotId: dto.shotId,
      config: dto.generationConfig,
      notifyWs: true,
    });

    return {
      code: 0,
      data: {
        taskId: result.taskId,
        status: result.status,
      },
      msg: "success",
      timestamp: Date.now(),
    };
  }

  @ApiOperation({ summary: "批量生成分镜视频（内部接口）" })
  @Post("video-gen/shots/batch")
  async createBatchTasks(
    @Body(new ZodValidationPipe(InternalBatchCreateVideoGenSchema))
    dto: InternalBatchCreateVideoGenDto,
  ) {
    const systemUserId = "system";

    const result = await this.videoGenService.createBatchTasks(systemUserId, {
      projectId: dto.projectId,
      shots: dto.shots.map((s) => ({
        shotId: s.shotId,
        config: s.generationConfig,
      })),
      commonConfig: dto.commonConfig,
      notifyWs: true,
    });

    return {
      code: 0,
      data: {
        batchId: result.batchId,
        tasks: result.tasks,
      },
      msg: "success",
      timestamp: Date.now(),
    };
  }
}
