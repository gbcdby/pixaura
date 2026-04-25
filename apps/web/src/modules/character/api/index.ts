import { api } from "@/utils/request";
import type {
  CreateCharacterDto,
  UpdateCharacterDto,
  QueryCharactersDto,
  BatchCreateCharactersDto,
  GenerateImageDto,
  UploadImageDto,
  ImportCharactersDto,
  CharacterListItemDto,
  CharacterDetailDto,
  GenerateImageTaskDto,
  BatchCreateCharactersResultDto,
  ImportCharactersResultDto,
} from "@pixaura/shared-types";

const BASE_URL = "/projects";
const CHARACTERS_URL = "/characters";

/**
 * 角色 API
 */
export const characterApi = {
  /**
   * 创建角色
   */
  createCharacter(projectId: string, data: CreateCharacterDto) {
    return api.post<CharacterDetailDto>(
      `${BASE_URL}/${projectId}${CHARACTERS_URL}`,
      data,
    );
  },

  /**
   * 查询角色列表
   */
  queryCharacters(projectId: string, params: QueryCharactersDto) {
    return api.get<{
      list: CharacterListItemDto[];
      pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
      };
    }>(`${BASE_URL}/${projectId}${CHARACTERS_URL}`, { params });
  },

  /**
   * 获取角色详情
   */
  getCharacter(characterId: string) {
    return api.get<CharacterDetailDto>(`${CHARACTERS_URL}/${characterId}`);
  },

  /**
   * 更新角色
   */
  updateCharacter(characterId: string, data: UpdateCharacterDto) {
    return api.patch<CharacterDetailDto>(
      `${CHARACTERS_URL}/${characterId}`,
      data,
    );
  },

  /**
   * 删除角色
   */
  deleteCharacter(characterId: string) {
    return api.delete(`${CHARACTERS_URL}/${characterId}`);
  },

  /**
   * 批量删除角色
   */
  batchDeleteCharacters(ids: string[]) {
    return api.delete(`${CHARACTERS_URL}/batch`, { data: { ids } });
  },

  /**
   * 批量创建角色（从剧本）
   */
  batchCreateCharacters(projectId: string, data: BatchCreateCharactersDto) {
    return api.post<BatchCreateCharactersResultDto>(
      `${BASE_URL}/${projectId}${CHARACTERS_URL}/batch`,
      data,
    );
  },

  // ==================== 图片管理 ====================

  /**
   * 异步生成角色参考图
   */
  generateImage(characterId: string, data: GenerateImageDto) {
    return api.post<GenerateImageTaskDto>(
      `${CHARACTERS_URL}/${characterId}/images/generate`,
      data,
    );
  },

  /**
   * 上传角色参考图
   */
  uploadImage(characterId: string, data: UploadImageDto, file: File) {
    const formData = new FormData();
    formData.append("file", file);

    // type 通过 query 参数传递给后端
    const params = new URLSearchParams();
    params.append("type", data.type);

    return api.post(
      `${CHARACTERS_URL}/${characterId}/images/upload?${params.toString()}`,
      formData,
    );
  },

  /**
   * 删除角色参考图
   */
  deleteImage(characterId: string, imageId: string) {
    return api.delete(`${CHARACTERS_URL}/${characterId}/images/${imageId}`);
  },

  /**
   * 获取图片版本历史
   */
  getImageVersions(characterId: string, type: string) {
    return api.get(`${CHARACTERS_URL}/${characterId}/images/${type}/versions`);
  },

  // ==================== 跨项目导入 ====================

  /**
   * 从其他项目导入角色
   */
  importCharacters(projectId: string, data: ImportCharactersDto) {
    return api.post<ImportCharactersResultDto>(
      `${BASE_URL}/${projectId}${CHARACTERS_URL}/import`,
      data,
    );
  },

  /**
   * 查询可导入的角色列表
   */
  queryImportableCharacters(_projectId: string, sourceProjectId: string) {
    return api.get<{ list: unknown[]; total: number }>(
      `${BASE_URL}/${sourceProjectId}${CHARACTERS_URL}`,
      {
        params: { status: "active", pageSize: 100 },
      },
    );
  },
};
