/**
 * 图片生成内部接口 Controller
 * 供其他模块调用的内部接口
 */
import { Controller, Post, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { ImageGenerationService } from "../services";
import {
  InternalCreateCharacterViewsSchema,
  InternalCreateSceneViewsSchema,
  InternalCreatePropViewsSchema,
  InternalCreateStoryboardRefSchema,
  InternalCreateCharacterViewsDto,
  InternalCreateSceneViewsDto,
  InternalCreatePropViewsDto,
  InternalCreateStoryboardRefDto,
} from "@pixaura/shared-types";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";

@ApiTags("图片生成 - 内部接口")
@Controller("internal/image-gen")
@UseGuards(JwtAuthGuard)
export class InternalImageGenerationController {
  constructor(private imageGenService: ImageGenerationService) {}

  /**
   * 生成角色四视图
   */
  @Post("character-views")
  @ApiOperation({ summary: "生成角色四视图（内部接口）" })
  async createCharacterViews(
    @Body(new ZodValidationPipe(InternalCreateCharacterViewsSchema))
    dto: InternalCreateCharacterViewsDto,
  ) {
    // 内部接口使用系统用户ID
    const systemUserId = "system";
    const result = await this.imageGenService.createBatchTask(systemUserId, {
      projectId: dto.projectId,
      sceneType: "character_views",
      config: {
        modelId: dto.generationConfig?.modelId || "default",
        basePrompt: dto.characterDescription,
        negativePrompt: "",
        width: 768,
        height: 1024,
        style: dto.generationConfig?.style,
        shareSeed: true,
        baseSeed: dto.generationConfig?.seed,
        items: [
          {
            index: 0,
            type: "front_view",
            promptSuffix: "front view, facing camera, full body",
          },
          {
            index: 1,
            type: "side_view",
            promptSuffix: "side view, 90 degree profile, full body",
          },
          {
            index: 2,
            type: "back_view",
            promptSuffix: "back view, facing away from camera, full body",
          },
          {
            index: 3,
            type: "angle_view",
            promptSuffix: "45 degree angle view, three-quarter view, full body",
          },
        ],
      },
      notifyWs: true,
    });

    return {
      code: 0,
      data: {
        taskId: result.taskId,
        status: result.status,
      },
      msg: "success",
    };
  }

  /**
   * 生成场景参考图
   */
  @Post("scene-views")
  @ApiOperation({ summary: "生成场景参考图（内部接口）" })
  async createSceneViews(
    @Body(new ZodValidationPipe(InternalCreateSceneViewsSchema))
    dto: InternalCreateSceneViewsDto,
  ) {
    const variants = dto.variants || ["panoramic"];
    const items = variants.map((variant: string, index: number) => ({
      index,
      type: variant,
      promptSuffix:
        variant === "panoramic"
          ? "panoramic view"
          : variant === "day"
            ? "daytime lighting"
            : variant === "night"
              ? "nighttime lighting"
              : `${variant} weather`,
    }));

    // 内部接口使用系统用户ID
    const systemUserId = "system";
    const result = await this.imageGenService.createBatchTask(systemUserId, {
      projectId: dto.projectId,
      sceneType: "scene_views",
      config: {
        modelId: dto.generationConfig?.modelId || "default",
        basePrompt: dto.sceneDescription,
        negativePrompt: "",
        width: 1024,
        height: 576,
        style: dto.generationConfig?.style,
        shareSeed: true,
        baseSeed: dto.generationConfig?.seed,
        items,
      },
      notifyWs: true,
    });

    return {
      code: 0,
      data: {
        taskId: result.taskId,
        status: result.status,
      },
      msg: "success",
    };
  }

  /**
   * 生成道具三视图
   */
  @Post("prop-views")
  @ApiOperation({ summary: "生成道具三视图（内部接口）" })
  async createPropViews(
    @Body(new ZodValidationPipe(InternalCreatePropViewsSchema))
    dto: InternalCreatePropViewsDto,
  ) {
    // 内部接口使用系统用户ID
    const systemUserId = "system";
    const result = await this.imageGenService.createBatchTask(systemUserId, {
      projectId: dto.projectId,
      sceneType: "prop_views",
      config: {
        modelId: dto.generationConfig?.modelId || "default",
        basePrompt: dto.propDescription,
        negativePrompt: "",
        width: 1024,
        height: 1024,
        style: dto.generationConfig?.style,
        shareSeed: true,
        baseSeed: dto.generationConfig?.seed,
        items: [
          { index: 0, type: "front_view", promptSuffix: "front view" },
          { index: 1, type: "side_view", promptSuffix: "side view" },
          { index: 2, type: "top_view", promptSuffix: "top view" },
        ],
      },
      notifyWs: true,
    });

    return {
      code: 0,
      data: {
        taskId: result.taskId,
        status: result.status,
      },
      msg: "success",
    };
  }

  /**
   * 生成分镜参考图
   */
  @Post("storyboard-ref")
  @ApiOperation({ summary: "生成分镜参考图（内部接口）" })
  async createStoryboardRef(
    @Body(new ZodValidationPipe(InternalCreateStoryboardRefSchema))
    dto: InternalCreateStoryboardRefDto,
  ) {
    // 内部接口使用系统用户ID
    const systemUserId = "system";
    const result = await this.imageGenService.createTextToImageTask(
      systemUserId,
      {
        projectId: dto.projectId,
        sceneType: "storyboard_reference",
        config: {
          modelId: dto.generationConfig?.modelId || "default",
          prompt: dto.description.detailed,
          negativePrompt: "",
          width: 1024,
          height: 1024,
          seed: dto.generationConfig?.seed,
          style: dto.generationConfig?.style,
          strength: 0.7,
        },
        notifyWs: true,
      },
    );

    return {
      code: 0,
      data: {
        taskId: result.taskId,
        status: result.status,
      },
      msg: "success",
    };
  }
}
