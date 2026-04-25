/**
 * 图片生成任务 Repository
 */
import { Injectable } from "@nestjs/common";
import { DataSource, Repository, In, Not, IsNull, LessThan } from "typeorm";
import { ImageGenerationTaskEntity, ImageGenTaskStatus } from "../entities";

@Injectable()
export class ImageGenerationTaskRepository extends Repository<ImageGenerationTaskEntity> {
  constructor(private dataSource: DataSource) {
    super(ImageGenerationTaskEntity, dataSource.createEntityManager());
  }

  /**
   * 根据ID查找任务（包含结果）
   */
  async findByIdWithResults(
    id: string,
  ): Promise<ImageGenerationTaskEntity | null> {
    return this.findOne({
      where: { id },
      relations: ["results"],
    });
  }

  /**
   * 查找项目的任务列表
   */
  async findByProjectId(
    projectId: string,
    options: {
      status?: ImageGenTaskStatus | ImageGenTaskStatus[];
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<[ImageGenerationTaskEntity[], number]> {
    const { status, limit = 20, offset = 0 } = options;

    const where: Record<string, unknown> = { projectId };

    if (status) {
      where.status = Array.isArray(status) ? In(status) : status;
    }

    return this.findAndCount({
      where,
      relations: ["results"],
      order: { createdAt: "DESC" },
      take: limit,
      skip: offset,
    });
  }

  /**
   * 查找进行中的任务
   */
  async findActiveTasks(
    projectId: string,
  ): Promise<ImageGenerationTaskEntity[]> {
    return this.find({
      where: {
        projectId,
        status: In(["pending", "queued", "generating"]),
      },
      relations: ["results"],
      order: { createdAt: "DESC" },
    });
  }

  /**
   * 查找用户的任务统计
   */
  async getUserTaskStats(
    userId: string,
    date: Date = new Date(),
  ): Promise<{
    taskCount: number;
    totalCost: number;
    totalImages: number;
  }> {
    const result = await this.createQueryBuilder("task")
      .select([
        "COUNT(*) as task_count",
        "SUM((task.cost->>'actualCost')::numeric) as total_cost",
        "SUM((task.progress->>'completed')::int) as total_images",
      ])
      .where("task.created_by = :userId", { userId })
      .andWhere("DATE(task.created_at) = DATE(:date)", { date })
      .andWhere("task.deleted_at IS NULL")
      .getRawOne();

    return {
      taskCount: parseInt(result.task_count, 10) || 0,
      totalCost: parseFloat(result.total_cost) || 0,
      totalImages: parseInt(result.total_images, 10) || 0,
    };
  }

  /**
   * 更新任务状态
   */
  async updateStatus(
    id: string,
    status: ImageGenTaskStatus,
    error?: { code: number; message: string; details?: string },
  ): Promise<void> {
    const updateData: Record<string, unknown> = { status };

    if (error) {
      updateData.error = error;
    }

    if (status === "generating") {
      updateData.startedAt = new Date();
    }

    if (
      ["completed", "partial_failed", "failed", "cancelled"].includes(status)
    ) {
      updateData.completedAt = new Date();
    }

    await this.update(id, updateData);
  }

  /**
   * 查找需要清理的旧任务
   */
  async findTasksForCleanup(
    days: number = 90,
  ): Promise<ImageGenerationTaskEntity[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return this.find({
      where: {
        createdAt: LessThan(cutoffDate),
        deletedAt: IsNull(),
      },
      withDeleted: true,
    });
  }
}
