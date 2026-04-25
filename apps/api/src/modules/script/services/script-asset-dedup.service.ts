import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, IsNull } from "typeorm";
import { Script } from "../entities/script.entity";
import {
  Collaborator,
  CollaboratorRole,
} from "../../project/entities/collaborator.entity";
import { Project } from "../../project/entities/project.entity";
import { CharacterService } from "../../character/services/character.service";
import { SceneService } from "../../scene/services/scene.service";
import { PropService } from "../../prop/services/prop.service";

/**
 * 脚本资产查重服务
 * 负责在角色/场景/道具解析及生成前，按名称匹配项目已有资产
 */
@Injectable()
export class ScriptAssetDedupService {
  private readonly logger = new Logger(ScriptAssetDedupService.name);

  constructor(
    @InjectRepository(Script)
    private readonly scriptRepository: Repository<Script>,
    @InjectRepository(Collaborator)
    private readonly collaboratorRepository: Repository<Collaborator>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    private readonly characterService: CharacterService,
    private readonly sceneService: SceneService,
    private readonly propService: PropService,
  ) {}

  // ==================== 权限 ====================

  private async checkProjectAccess(
    userId: string,
    projectId: string,
    requireRole?: (typeof CollaboratorRole)[keyof typeof CollaboratorRole],
  ): Promise<void> {
    const project = await this.projectRepository.findOne({
      where: { projectId, isDeleted: false },
    });
    if (!project) throw new NotFoundException("项目不存在");

    const collaborator = await this.collaboratorRepository.findOne({
      where: { projectId, userId },
    });
    const userRole = collaborator?.role ?? null;
    if (!userRole) throw new ForbiddenException("您不是该项目成员");

    if (
      requireRole === CollaboratorRole.EDITOR &&
      userRole !== CollaboratorRole.OWNER &&
      userRole !== CollaboratorRole.EDITOR
    ) {
      throw new ForbiddenException("需要编辑权限");
    }
  }

  // ==================== 核心查重逻辑 ====================

  /**
   * 对剧本 content 中所有 assetStatus=will_create 的资产执行查重，将结果回写
   * @param script 已加载的 Script 实体（不含 projectId 校验）
   */
  async dedupScriptAssets(script: Script): Promise<{
    checked: number;
    matched: number;
    updated: number;
    details: {
      characters: { checked: number; matched: number };
      scenes: { checked: number; matched: number };
      props: { checked: number; matched: number };
    };
  }> {
    const projectId = script.projectId;
    const content = (script.content as Record<string, unknown>) ?? {};

    const characters =
      (content.characters as Array<Record<string, unknown>>) ?? [];
    const scenes = (content.scenes as Array<Record<string, unknown>>) ?? [];
    const props = (content.props as Array<Record<string, unknown>>) ?? [];

    let totalChecked = 0;
    let totalMatched = 0;
    let totalUpdated = 0;

    const charStats = { checked: 0, matched: 0 };
    const sceneStats = { checked: 0, matched: 0 };
    const propStats = { checked: 0, matched: 0 };

    // 查重并回填角色
    for (const char of characters) {
      const assetStatus = char.assetStatus as string | undefined;
      if (assetStatus === "imported") continue; // 已匹配，跳过

      const name = char.name as string | undefined;
      if (!name) continue;

      charStats.checked++;
      totalChecked++;

      const matched = await this.characterService.findByProjectAndName(
        projectId,
        name,
      );

      if (matched) {
        char.assetStatus = "imported";
        char.importedAsset = {
          sourceProjectId: projectId,
          sourceAssetId: matched.id,
          localAssetId: matched.id,
          copiedAt: new Date().toISOString(),
        };
        // 如果资产库有封面图，同步过来（第一张 current 图）
        charStats.matched++;
        totalMatched++;
        totalUpdated++;
      } else {
        char.assetStatus = "will_create";
        if (!char.creationPlan) {
          char.creationPlan = { useDescription: true };
        }
      }
    }

    // 查重并回填场景
    for (const scene of scenes) {
      const assetStatus = scene.assetStatus as string | undefined;
      if (assetStatus === "imported") continue;

      const name = scene.name as string | undefined;
      if (!name) continue;

      sceneStats.checked++;
      totalChecked++;

      const matched = await this.sceneService.findByProjectAndName(
        projectId,
        name,
      );

      if (matched) {
        scene.assetStatus = "imported";
        scene.importedAsset = {
          sourceProjectId: projectId,
          sourceAssetId: matched.id,
          localAssetId: matched.id,
          copiedAt: new Date().toISOString(),
        };
        sceneStats.matched++;
        totalMatched++;
        totalUpdated++;
      } else {
        scene.assetStatus = "will_create";
        if (!scene.creationPlan) {
          scene.creationPlan = { useDescription: true };
        }
      }
    }

    // 查重并回填道具
    for (const prop of props) {
      const assetStatus = prop.assetStatus as string | undefined;
      if (assetStatus === "imported") continue;

      const name = prop.name as string | undefined;
      if (!name) continue;

      propStats.checked++;
      totalChecked++;

      const matched = await this.propService.findByProjectAndName(
        projectId,
        name,
      );

      if (matched) {
        prop.assetStatus = "imported";
        prop.importedAsset = {
          sourceProjectId: projectId,
          sourceAssetId: matched.id,
          localAssetId: matched.id,
          copiedAt: new Date().toISOString(),
        };
        propStats.matched++;
        totalMatched++;
        totalUpdated++;
      } else {
        prop.assetStatus = "will_create";
        if (!prop.creationPlan) {
          prop.creationPlan = { useDescription: true };
        }
      }
    }

    // 将修改写回 content（原地修改，已引用同一对象，只需重新赋值触发 dirty）
    script.content = {
      ...content,
      characters,
      scenes,
      props,
    };

    return {
      checked: totalChecked,
      matched: totalMatched,
      updated: totalUpdated,
      details: {
        characters: charStats,
        scenes: sceneStats,
        props: propStats,
      },
    };
  }

  // ==================== 对外 API ====================

  /**
   * 单资产查重接口
   */
  async dedupSingleAsset(
    userId: string,
    projectId: string,
    scriptId: string,
    refId: string,
    assetType: "character" | "scene" | "prop",
  ): Promise<{
    matched: boolean;
    matchedAsset: {
      id: string;
      name: string;
      description: string | null;
      coverUrl: string | null;
    } | null;
  }> {
    await this.checkProjectAccess(userId, projectId, CollaboratorRole.EDITOR);

    const script = await this.scriptRepository.findOne({
      where: { id: scriptId, projectId, deletedAt: IsNull() },
    });
    if (!script) throw new NotFoundException("剧本不存在");

    const content = (script.content as Record<string, unknown>) ?? {};
    const assetRef = this.findRefById(content, refId, assetType);

    if (!assetRef) {
      throw new UnprocessableEntityException({
        code: 1354,
        message: "refId 在剧本中不存在",
      });
    }

    const name = assetRef.name as string | undefined;
    if (!name) {
      return { matched: false, matchedAsset: null };
    }

    if (assetType === "character") {
      const matched = await this.characterService.findByProjectAndName(
        projectId,
        name,
      );
      if (!matched) return { matched: false, matchedAsset: null };
      return {
        matched: true,
        matchedAsset: {
          id: matched.id,
          name: matched.name,
          description: matched.description ?? null,
          coverUrl: null, // character 封面通过 images 关系取，这里简化为 null
        },
      };
    } else if (assetType === "scene") {
      const matched = await this.sceneService.findByProjectAndName(
        projectId,
        name,
      );
      if (!matched) return { matched: false, matchedAsset: null };
      return {
        matched: true,
        matchedAsset: {
          id: matched.id,
          name: matched.name,
          description: matched.description ?? null,
          coverUrl: null,
        },
      };
    } else {
      const matched = await this.propService.findByProjectAndName(
        projectId,
        name,
      );
      if (!matched) return { matched: false, matchedAsset: null };
      return {
        matched: true,
        matchedAsset: {
          id: matched.id,
          name: matched.name,
          description: matched.description ?? null,
          coverUrl: null,
        },
      };
    }
  }

  /**
   * 批量查重接口（对当前剧本中所有 will_create 资产查重）
   */
  async dedupAllAssets(
    userId: string,
    projectId: string,
    scriptId: string,
  ): Promise<{
    checked: number;
    matched: number;
    updated: number;
    details: {
      characters: { checked: number; matched: number };
      scenes: { checked: number; matched: number };
      props: { checked: number; matched: number };
    };
  }> {
    await this.checkProjectAccess(userId, projectId, CollaboratorRole.EDITOR);

    const script = await this.scriptRepository.findOne({
      where: { id: scriptId, projectId, deletedAt: IsNull() },
    });
    if (!script) throw new NotFoundException("剧本不存在");

    const result = await this.dedupScriptAssets(script);
    await this.scriptRepository.save(script);

    this.logger.log(
      `批量查重完成: scriptId=${scriptId}, checked=${result.checked}, matched=${result.matched}`,
    );

    return result;
  }

  // ==================== 辅助 ====================

  private findRefById(
    content: Record<string, unknown>,
    refId: string,
    assetType: "character" | "scene" | "prop",
  ): Record<string, unknown> | null {
    const keyMap: Record<string, string> = {
      character: "characters",
      scene: "scenes",
      prop: "props",
    };
    const key = keyMap[assetType];
    const arr = (content[key] as Array<Record<string, unknown>>) ?? [];
    return arr.find((item) => item.id === refId) ?? null;
  }
}
