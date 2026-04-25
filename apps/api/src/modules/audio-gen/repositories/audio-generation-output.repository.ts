/**
 * 音频生成输出 Repository
 */
import { Injectable } from "@nestjs/common";
import { DataSource, Repository, In } from "typeorm";
import {
  AudioGenerationOutputEntity,
  AudioModerationStatus,
} from "../entities";

@Injectable()
export class AudioGenerationOutputRepository extends Repository<AudioGenerationOutputEntity> {
  constructor(private dataSource: DataSource) {
    super(AudioGenerationOutputEntity, dataSource.createEntityManager());
  }

  /**
   * 根据任务ID查找输出
   */
  async findByTaskId(taskId: string): Promise<AudioGenerationOutputEntity[]> {
    return this.find({
      where: { taskId },
      order: { createdAt: "ASC" },
    });
  }

  /**
   * 根据任务ID和类型查找输出
   */
  async findByTaskIdAndType(
    taskId: string,
    type: string,
  ): Promise<AudioGenerationOutputEntity | null> {
    return this.findOne({
      where: { taskId, type: type as AudioGenerationOutputEntity["type"] },
    });
  }

  /**
   * 批量创建输出
   */
  async createOutputs(
    outputs: Array<{
      taskId: string;
      type: string;
      file: AudioGenerationOutputEntity["file"];
      metadata?: AudioGenerationOutputEntity["metadata"];
    }>,
  ): Promise<AudioGenerationOutputEntity[]> {
    const entities = outputs.map((o) =>
      this.create({
        taskId: o.taskId,
        type: o.type as AudioGenerationOutputEntity["type"],
        file: o.file,
        metadata: o.metadata || null,
      }),
    );

    return this.save(entities);
  }

  /**
   * 更新文件信息
   */
  async updateFileInfo(
    id: string,
    file: AudioGenerationOutputEntity["file"],
  ): Promise<void> {
    await this.update(id, { file });
  }

  /**
   * 更新元数据
   */
  async updateMetadata(
    id: string,
    metadata: AudioGenerationOutputEntity["metadata"],
  ): Promise<void> {
    await this.update(id, { metadata });
  }

  /**
   * 更新审核状态
   */
  async updateModerationStatus(
    id: string,
    status: AudioModerationStatus,
    rejectReason?: string,
  ): Promise<void> {
    const moderation: AudioGenerationOutputEntity["moderation"] = {
      status,
      checkedAt: new Date().toISOString(),
      ...(rejectReason && { rejectReason }),
    };

    await this.update(id, { moderation });
  }

  /**
   * 查找待审核的输出
   */
  async findPendingModeration(
    limit: number = 100,
  ): Promise<AudioGenerationOutputEntity[]> {
    return this.createQueryBuilder("output")
      .leftJoinAndSelect("output.task", "task")
      .where("output.moderation->>'status' = :status", { status: "pending" })
      .orWhere("output.moderation IS NULL")
      .orderBy("output.created_at", "ASC")
      .limit(limit)
      .getMany();
  }

  /**
   * 计算任务的总音频时长
   */
  async getTotalDurationByTaskId(taskId: string): Promise<number> {
    const result = await this.createQueryBuilder("output")
      .select("SUM((output.file->>'duration')::numeric)", "total_duration")
      .where("output.task_id = :taskId", { taskId })
      .getRawOne();

    return parseFloat(result?.total_duration || 0);
  }

  /**
   * 查找项目的所有音频输出
   */
  async findByProjectId(
    projectId: string,
    options: {
      type?: string | string[];
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<[AudioGenerationOutputEntity[], number]> {
    const { type, limit = 20, offset = 0 } = options;

    const query = this.createQueryBuilder("output")
      .leftJoin("output.task", "task")
      .where("task.project_id = :projectId", { projectId })
      .andWhere("task.deleted_at IS NULL");

    if (type) {
      if (Array.isArray(type)) {
        query.andWhere("output.type IN (:...types)", { types: type });
      } else {
        query.andWhere("output.type = :type", { type });
      }
    }

    query.orderBy("output.created_at", "DESC");

    return query.take(limit).skip(offset).getManyAndCount();
  }

  /**
   * 删除任务的输出
   */
  async deleteByTaskId(taskId: string): Promise<void> {
    await this.delete({ taskId });
  }
}
