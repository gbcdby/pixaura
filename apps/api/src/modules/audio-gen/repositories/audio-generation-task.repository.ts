/**
 * 音频生成任务 Repository
 */
import { Injectable } from "@nestjs/common";
import { DataSource, Repository, In, Not, IsNull, LessThan } from "typeorm";
import { AudioGenerationTaskEntity, AudioGenTaskStatus } from "../entities";

@Injectable()
export class AudioGenerationTaskRepository extends Repository<AudioGenerationTaskEntity> {
  constructor(private dataSource: DataSource) {
    super(AudioGenerationTaskEntity, dataSource.createEntityManager());
  }

  /**
   * 根据ID查找任务（包含输出）
   */
  async findByIdWithOutputs(
    id: string,
  ): Promise<AudioGenerationTaskEntity | null> {
    return this.findOne({
      where: { id },
      relations: ["outputs"],
    });
  }

  /**
   * 查找项目的任务列表
   */
  async findByProjectId(
    projectId: string,
    options: {
      type?: string;
      status?: AudioGenTaskStatus | AudioGenTaskStatus[];
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<[AudioGenerationTaskEntity[], number]> {
    const { type, status, limit = 20, offset = 0 } = options;

    const where: Record<string, unknown> = { projectId };

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = Array.isArray(status) ? In(status) : status;
    }

    return this.findAndCount({
      where,
      relations: ["outputs"],
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
  ): Promise<AudioGenerationTaskEntity[]> {
    return this.find({
      where: {
        projectId,
        status: In(["pending", "queued", "processing"]),
      },
      relations: ["outputs"],
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
    totalDuration: number;
  }> {
    const result = await this.createQueryBuilder("task")
      .select([
        "COUNT(*) as task_count",
        "SUM((task.cost->>'actualCost')::numeric) as total_cost",
      ])
      .where("task.created_by = :userId", { userId })
      .andWhere("DATE(task.created_at) = DATE(:date)", { date })
      .andWhere("task.deleted_at IS NULL")
      .getRawOne();

    // 计算总时长需要关联输出表
    const durationResult = await this.createQueryBuilder("task")
      .leftJoin("task.outputs", "output")
      .select("SUM((output.file->>'duration')::numeric)", "total_duration")
      .where("task.created_by = :userId", { userId })
      .andWhere("DATE(task.created_at) = DATE(:date)", { date })
      .andWhere("task.deleted_at IS NULL")
      .getRawOne();

    return {
      taskCount: parseInt(result.task_count, 10) || 0,
      totalCost: parseFloat(result.total_cost) || 0,
      totalDuration: parseFloat(durationResult?.total_duration || 0),
    };
  }

  /**
   * 按类型统计任务
   */
  async getTaskStatsByType(projectId: string): Promise<{
    tts: number;
    lipSync: number;
    bgm: number;
    ambience: number;
    mixing: number;
  }> {
    const result = await this.createQueryBuilder("task")
      .select(["task.type", "COUNT(*) as count"])
      .where("task.project_id = :projectId", { projectId })
      .andWhere("task.deleted_at IS NULL")
      .groupBy("task.type")
      .getRawMany();

    const stats = { tts: 0, lipSync: 0, bgm: 0, ambience: 0, mixing: 0 };
    result.forEach((row) => {
      const count = parseInt(row.count, 10) || 0;
      switch (row.task_type) {
        case "tts":
          stats.tts = count;
          break;
        case "lip_sync":
          stats.lipSync = count;
          break;
        case "bgm":
          stats.bgm = count;
          break;
        case "ambience":
          stats.ambience = count;
          break;
        case "mixing":
          stats.mixing = count;
          break;
      }
    });

    return stats;
  }

  /**
   * 更新任务状态
   */
  async updateStatus(
    id: string,
    status: AudioGenTaskStatus,
    error?: { code: number; message: string; details?: string },
  ): Promise<void> {
    const updateData: Record<string, unknown> = { status };

    if (error) {
      updateData.error = error;
    }

    if (status === "processing") {
      updateData.startedAt = new Date();
    }

    if (["completed", "failed", "cancelled"].includes(status)) {
      updateData.completedAt = new Date();
    }

    await this.update(id, updateData);
  }

  /**
   * 更新任务进度
   */
  async updateProgress(
    id: string,
    progress: { percentage: number; currentStep: string; message?: string },
  ): Promise<void> {
    await this.update(id, { progress });
  }

  /**
   * 查找需要清理的旧任务
   */
  async findTasksForCleanup(
    days: number = 90,
  ): Promise<AudioGenerationTaskEntity[]> {
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

  /**
   * 查找关联的生成任务的所有音频任务
   */
  async findByGenerationTaskId(
    generationTaskId: string,
  ): Promise<AudioGenerationTaskEntity[]> {
    return this.find({
      where: { generationTaskId },
      relations: ["outputs"],
      order: { createdAt: "ASC" },
    });
  }
}
