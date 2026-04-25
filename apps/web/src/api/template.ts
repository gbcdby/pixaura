import { api } from "@/utils/request";
import type { QueryTemplatesDto, TemplateType } from "@pixaura/shared-types";

/**
 * 模板列表项（列表页使用）
 */
export interface TemplateListItem {
  id: string;
  name: string;
  description: string | null;
  type: TemplateType;
  creator: {
    id: string | null;
    username: string;
  } | null;
  tags: string[];
  usageCount: number;
  preview: {
    characterCount: number;
    sceneCount: number;
    actCount: number;
  };
  createdAt: string;
  updatedAt?: string;
}

/**
 * 模板详情（详情页使用）
 */
export interface TemplateDetail extends TemplateListItem {
  content: {
    characters: Array<{
      name: string;
      description?: string;
      personality?: string;
      age?: string;
      gender?: string;
      importance: string;
    }>;
    scenes: Array<{
      name: string;
      description?: string;
      atmosphere?: string;
      timeOfDay?: string;
    }>;
    props: Array<{
      name: string;
      description?: string;
      category?: string;
    }>;
    scriptOutline: {
      title: string;
      genre?: string;
      tone?: string;
      targetDuration?: number;
      summary: string;
      acts: Array<{
        number: number;
        title: string;
        summary: string;
        scenes: Array<{
          number: number;
          title: string;
          setting: {
            time: string;
            location: string;
            atmosphere: string;
          };
          characters: string[];
          summary: string;
        }>;
      }>;
    };
  };
  modelConfigs: Record<string, string> | null;
}

/**
 * 从模板创建项目的响应
 */
export interface CreateProjectFromTemplateResponse {
  id: string;
  name: string;
  status: string;
  role: string;
  imported: {
    characterCount: number;
    sceneCount: number;
    propCount: number;
    scriptCreated: boolean;
  };
  createdAt: string;
}

/**
 * 保存模板选项
 */
export interface SaveTemplateOptions {
  includeCharacters: boolean;
  includeScenes: boolean;
  includeProps: boolean;
  includeScriptOutline: boolean;
  includeModelConfigs: boolean;
}

/**
 * 从模板创建项目选项
 */
export interface CreateFromTemplateOptions {
  includeCharacters: boolean;
  includeScenes: boolean;
  includeProps: boolean;
  includeScriptOutline: boolean;
  includeModelConfigs: boolean;
}

/**
 * 模板 API 客户端
 */
export const templateApi = {
  /**
   * 获取模板列表
   * @param params 查询参数
   */
  getTemplates(params: QueryTemplatesDto): Promise<{
    list: TemplateListItem[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  }> {
    return api.get("/project-templates", { params });
  },

  /**
   * 获取系统模板列表（简化版）
   * @param limit 返回数量
   */
  getSystemTemplates(limit: number = 10): Promise<{
    list: TemplateListItem[];
  }> {
    return api.get("/project-templates/system", { params: { limit } });
  },

  /**
   * 获取模板详情
   * @param templateId 模板ID
   */
  getTemplateDetail(templateId: string): Promise<TemplateDetail> {
    return api.get(`/project-templates/${templateId}`);
  },

  /**
   * 保存项目为模板
   * @param projectId 项目ID
   * @param data 保存数据
   */
  saveProjectAsTemplate(
    projectId: string,
    data: {
      name: string;
      description?: string;
      tags: string[];
      options: SaveTemplateOptions;
    },
  ): Promise<{
    id: string;
    name: string;
    type: TemplateType;
    createdAt: string;
  }> {
    return api.post(`/projects/${projectId}/save-template`, {
      name: data.name,
      description: data.description,
      tags: data.tags,
      options: {
        include_characters: data.options.includeCharacters,
        include_scenes: data.options.includeScenes,
        include_props: data.options.includeProps,
        include_script_outline: data.options.includeScriptOutline,
        include_model_configs: data.options.includeModelConfigs,
      },
    });
  },

  /**
   * 删除模板
   * @param templateId 模板ID
   */
  deleteTemplate(templateId: string): Promise<void> {
    return api.delete(`/project-templates/${templateId}`);
  },

  /**
   * 从模板创建项目
   * @param templateId 模板ID
   * @param data 创建数据
   */
  createProjectFromTemplate(
    templateId: string,
    data: {
      name: string;
      description?: string;
      coverUrl?: string;
      options: CreateFromTemplateOptions;
    },
  ): Promise<CreateProjectFromTemplateResponse> {
    return api.post(`/project-templates/${templateId}/create-project`, {
      name: data.name,
      description: data.description,
      cover_url: data.coverUrl,
      options: {
        include_characters: data.options.includeCharacters,
        include_scenes: data.options.includeScenes,
        include_props: data.options.includeProps,
        include_script_outline: data.options.includeScriptOutline,
        include_model_configs: data.options.includeModelConfigs,
      },
    });
  },
};
