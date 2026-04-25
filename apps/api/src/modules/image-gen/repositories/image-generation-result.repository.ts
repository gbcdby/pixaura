/**
 * 图片生成结果 Repository
 */
import { Injectable } from "@nestjs/common";
import { DataSource, Repository, In } from "typeorm";
import { ImageGenerationResultEntity } from "../entities";

@Injectable()
export class ImageGenerationResultRepository extends Repository<ImageGenerationResultEntity> {
  constructor(private dataSource: DataSource) {
    super(ImageGenerationResultEntity, dataSource.createEntityManager());
  }

  /**
   * 根据任务ID查找结果
   */
  async findByTaskId(taskId: string): Promise<ImageGenerationResultEntity[]> {
    return this.find({
      where: { taskId },
      order: { index: "ASC" },
    });
  }

  /**
   * 根据ID查找结果（包含任务信息）
   */
  async findByIdWithTask(
    id: string,
  ): Promise<ImageGenerationResultEntity | null> {
    return this.findOne({
      where: { id },
      relations: ["task"],
    });
  }

  /**
   * 批量创建结果
   */
  async batchCreate(
    taskId: string,
    items: Array<{
      index: number;
      type: string;
      generationParams: Record<string, unknown>;
    }>,
  ): Promise<ImageGenerationResultEntity[]> {
    const results = items.map((item) =>
      this.create({
        taskId,
        index: item.index,
        type: item.type,
        generationParams: item.generationParams as never,
        status: "pending",
      }),
    );

    return this.save(results);
  }

  /**
   * 更新结果状态为成功
   */
  async markAsSuccess(
    id: string,
    image: {
      url: string;
      thumbnailUrl: string;
      width: number;
      height: number;
      format: string;
      size: number;
    },
  ): Promise<void> {
    await this.update(id, {
      status: "success",
      image,
      completedAt: new Date(),
    });
  }

  /**
   * 更新结果状态为失败
   */
  async markAsFailed(
    id: string,
    error: { code: number; message: string },
  ): Promise<void> {
    await this.update(id, {
      status: "failed",
      error,
      completedAt: new Date(),
    });
  }

  /**
   * 更新审核状态
   */
  async updateModerationStatus(
    id: string,
    moderation: {
      status: "pending" | "approved" | "rejected";
      checkedAt?: string;
      rejectReason?: string;
    },
  ): Promise<void> {
    await this.update(id, { moderation });
  }

  /**
   * 查找需要审核的图片
   */
  async findPendingModeration(
    limit: number = 100,
  ): Promise<ImageGenerationResultEntity[]> {
    return this.createQueryBuilder("result")
      .where("result.status = 'success'")
      .andWhere(
        "(result.moderation IS NULL OR result.moderation->>'status' = 'pending')",
      )
      .orderBy("result.createdAt", "ASC")
      .limit(limit)
      .getMany();
  }

  /**
   * 统计任务结果
   */
  async countByTaskId(taskId: string): Promise<{
    total: number;
    success: number;
    failed: number;
  }> {
    const results = await this.findByTaskId(taskId);

    return {
      total: results.length,
      success: results.filter((r) => r.status === "success").length,
      failed: results.filter((r) => r.status === "failed").length,
    };
  }
}
