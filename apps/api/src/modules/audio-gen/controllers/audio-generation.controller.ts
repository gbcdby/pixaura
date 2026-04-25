/**
 * 音频生成 Controller (对外接口)
 */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Delete,
  UseGuards,
  Request,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { AudioGenerationService } from "../services/audio-generation.service";
import {
  CreateTTSTaskDto,
  CreateLipSyncTaskDto,
  CreateBGMTaskDto,
  CreateAmbienceTaskDto,
  CreateMixingTaskDto,
} from "@pixaura/shared-types";

interface RequestWithUser extends Request {
  user: {
    userId: string;
  };
}

@ApiTags("音频生成")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("audio-gen")
export class AudioGenerationController {
  constructor(private audioGenService: AudioGenerationService) {}

  /**
   * TTS 生成
   */
  @Post("tts")
  @ApiOperation({ summary: "TTS 文本转语音" })
  @ApiResponse({ status: 201, description: "创建成功" })
  @ApiResponse({ status: 400, description: "参数错误" })
  @ApiResponse({ status: 401, description: "未登录" })
  @ApiResponse({ status: 403, description: "无权访问" })
  async createTTS(
    @Request() req: RequestWithUser,
    @Body() dto: CreateTTSTaskDto,
  ) {
    const result = await this.audioGenService.createTTSTask(
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
   * 对口型合成
   */
  @Post("lip-sync")
  @ApiOperation({ summary: "对口型合成" })
  @ApiResponse({ status: 201, description: "创建成功" })
  @ApiResponse({ status: 400, description: "参数错误" })
  @ApiResponse({ status: 401, description: "未登录" })
  @ApiResponse({ status: 403, description: "无权访问" })
  async createLipSync(
    @Request() req: RequestWithUser,
    @Body() dto: CreateLipSyncTaskDto,
  ) {
    const result = await this.audioGenService.createLipSyncTask(
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
   * BGM 生成
   */
  @Post("bgm")
  @ApiOperation({ summary: "BGM 背景音乐生成" })
  @ApiResponse({ status: 201, description: "创建成功" })
  @ApiResponse({ status: 400, description: "参数错误" })
  @ApiResponse({ status: 401, description: "未登录" })
  @ApiResponse({ status: 403, description: "无权访问" })
  async createBGM(
    @Request() req: RequestWithUser,
    @Body() dto: CreateBGMTaskDto,
  ) {
    const result = await this.audioGenService.createBGMTask(
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
   * 环境音生成
   */
  @Post("ambience")
  @ApiOperation({ summary: "环境音效生成" })
  @ApiResponse({ status: 201, description: "创建成功" })
  @ApiResponse({ status: 400, description: "参数错误" })
  @ApiResponse({ status: 401, description: "未登录" })
  @ApiResponse({ status: 403, description: "无权访问" })
  async createAmbience(
    @Request() req: RequestWithUser,
    @Body() dto: CreateAmbienceTaskDto,
  ) {
    const result = await this.audioGenService.createAmbienceTask(
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
   * 混音
   */
  @Post("mix")
  @ApiOperation({ summary: "多轨道音频混音" })
  @ApiResponse({ status: 201, description: "创建成功" })
  @ApiResponse({ status: 400, description: "参数错误" })
  @ApiResponse({ status: 401, description: "未登录" })
  @ApiResponse({ status: 403, description: "无权访问" })
  async createMixing(
    @Request() req: RequestWithUser,
    @Body() dto: CreateMixingTaskDto,
  ) {
    const result = await this.audioGenService.createMixingTask(
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
  @ApiOperation({ summary: "获取音频生成任务列表" })
  @ApiResponse({ status: 200, description: "获取成功" })
  async getTaskList(
    @Request() req: RequestWithUser,
    @Query("projectId") projectId: string,
    @Query("type") type?: string,
    @Query("status") status?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    const result = await this.audioGenService.getTaskList(
      req.user.userId,
      projectId,
      {
        type,
        status,
        limit: limit ? parseInt(limit, 10) : 20,
        offset: offset ? parseInt(offset, 10) : 0,
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
  @ApiOperation({ summary: "获取音频生成任务详情" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 404, description: "任务不存在" })
  async getTaskDetail(
    @Request() req: RequestWithUser,
    @Param("id") taskId: string,
  ) {
    const result = await this.audioGenService.getTaskDetail(
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
  @ApiOperation({ summary: "取消音频生成任务" })
  @ApiResponse({ status: 200, description: "取消成功" })
  @ApiResponse({ status: 400, description: "无法取消" })
  @ApiResponse({ status: 404, description: "任务不存在" })
  async cancelTask(
    @Request() req: RequestWithUser,
    @Param("id") taskId: string,
  ) {
    const result = await this.audioGenService.cancelTask(
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
  @ApiOperation({ summary: "删除音频生成任务" })
  @ApiResponse({ status: 200, description: "删除成功" })
  @ApiResponse({ status: 404, description: "任务不存在" })
  async deleteTask(
    @Request() req: RequestWithUser,
    @Param("id") taskId: string,
  ) {
    await this.audioGenService.deleteTask(taskId, req.user.userId);
    return {
      code: 0,
      data: null,
      msg: "success",
    };
  }
}
