import { z } from "zod";

/**
 * 项目状态
 */
export const ProjectStatus = {
  DRAFT: "draft",
  ACTIVE: "active",
  COMPLETED: "completed",
  ARCHIVED: "archived",
} as const;

export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];
export type ProjectStatusType = ProjectStatus;

/**
 * 协作者角色
 */
export const CollaboratorRole = {
  OWNER: "owner",
  EDITOR: "editor",
  VIEWER: "viewer",
} as const;

export type CollaboratorRole =
  (typeof CollaboratorRole)[keyof typeof CollaboratorRole];
export type CollaboratorRoleType = CollaboratorRole;

/**
 * 模型类别
 */
export const ModelCategory = {
  TEXT_GENERATION: "TEXT_GENERATION",
  IMAGE_GENERATION: "IMAGE_GENERATION",
  VIDEO_GENERATION: "VIDEO_GENERATION",
  AUDIO_GENERATION: "AUDIO_GENERATION",
} as const;

export type ModelCategory = (typeof ModelCategory)[keyof typeof ModelCategory];

/**
 * 模板类型
 */
export const TemplateType = {
  SYSTEM: "system",
  USER: "user",
} as const;

export type TemplateType = (typeof TemplateType)[keyof typeof TemplateType];

/**
 * 模板状态
 */
export const TemplateStatus = {
  ENABLED: "enabled",
  DISABLED: "disabled",
} as const;

export type TemplateStatus =
  (typeof TemplateStatus)[keyof typeof TemplateStatus];

// ==================== 项目 DTOs ====================

/**
 * 创建项目 DTO
 */
export const CreateProjectSchema = z.object({
  name: z
    .string()
    .min(2, "项目名称至少2个字符")
    .max(50, "项目名称最多50个字符")
    .describe("项目名称"),
  description: z
    .string()
    .max(500, "项目描述最多500个字符")
    .optional()
    .describe("项目描述"),
  coverUrl: z
    .string()
    .url("封面URL格式不正确")
    .optional()
    .describe("封面图URL"),
  defaultModels: z
    .record(z.string().nullable())
    .optional()
    .describe("默认模型配置"),
});

export type CreateProjectDto = z.infer<typeof CreateProjectSchema>;

/**
 * 更新项目 DTO
 */
export const UpdateProjectSchema = z
  .object({
    name: z.string().min(2).max(50).optional().describe("项目名称"),
    description: z
      .string()
      .max(500)
      .nullable()
      .optional()
      .describe("项目描述，传null或空字符串表示清空"),
    coverUrl: z.string().url().nullable().optional().describe("封面图URL"),
    status: z
      .enum([
        ProjectStatus.DRAFT,
        ProjectStatus.ACTIVE,
        ProjectStatus.COMPLETED,
        ProjectStatus.ARCHIVED,
      ])
      .optional()
      .describe("项目状态"),
  })
  .strict();

export type UpdateProjectDto = z.infer<typeof UpdateProjectSchema>;

/**
 * 查询项目列表参数
 */
export const QueryProjectsSchema = z.object({
  status: z
    .enum([
      ProjectStatus.DRAFT,
      ProjectStatus.ACTIVE,
      ProjectStatus.COMPLETED,
      ProjectStatus.ARCHIVED,
    ])
    .optional()
    .describe("状态筛选"),
  role: z
    .enum([
      CollaboratorRole.OWNER,
      CollaboratorRole.EDITOR,
      CollaboratorRole.VIEWER,
    ])
    .optional()
    .describe("角色筛选"),
  keyword: z.string().optional().describe("关键词搜索"),
  page: z.coerce.number().int().positive().default(1).describe("页码"),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(100)
    .default(20)
    .describe("每页数量"),
});

export type QueryProjectsDto = z.infer<typeof QueryProjectsSchema>;

// ==================== 协作者 DTOs ====================

/**
 * 邀请协作者 DTO
 * 支持通过 userId 或 username 邀请
 */
export const InviteCollaboratorSchema = z
  .object({
    userId: z
      .string()
      .uuid("用户ID格式不正确")
      .optional()
      .describe("被邀请用户ID"),
    username: z
      .string()
      .min(1, "用户名不能为空")
      .optional()
      .describe("被邀请用户名"),
    role: z
      .enum([CollaboratorRole.EDITOR, CollaboratorRole.VIEWER])
      .default(CollaboratorRole.EDITOR)
      .describe("邀请角色"),
  })
  .refine((data) => data.userId || data.username, {
    message: "必须提供 userId 或 username 其中之一",
    path: ["userId"],
  });

export type InviteCollaboratorDto = z.infer<typeof InviteCollaboratorSchema>;

/**
 * 更新协作者角色 DTO
 */
export const UpdateCollaboratorRoleSchema = z.object({
  role: z
    .enum([CollaboratorRole.EDITOR, CollaboratorRole.VIEWER])
    .describe("新角色"),
});

export type UpdateCollaboratorRoleDto = z.infer<
  typeof UpdateCollaboratorRoleSchema
>;

// ==================== 邀请链接 DTOs ====================

/**
 * 创建邀请链接 DTO
 */
export const CreateInviteLinkSchema = z.object({
  role: z
    .enum([CollaboratorRole.EDITOR, CollaboratorRole.VIEWER])
    .default(CollaboratorRole.EDITOR)
    .describe("邀请角色"),
  expireDays: z
    .number()
    .int()
    .min(1)
    .max(30)
    .default(7)
    .describe("有效期（天）"),
});

export type CreateInviteLinkDto = z.infer<typeof CreateInviteLinkSchema>;

/**
 * 通过链接加入项目 DTO
 */
export const JoinProjectSchema = z.object({
  inviteCode: z.string().min(1).describe("邀请码"),
});

export type JoinProjectDto = z.infer<typeof JoinProjectSchema>;

// ==================== 模型配置 DTOs ====================

/**
 * 更新项目模型配置 DTO
 */
export const UpdateProjectModelsSchema = z
  .record(z.string().nullable().describe("模型ID，null表示使用默认"))
  .describe("模型配置，key为ModelCategory");

export type UpdateProjectModelsDto = z.infer<typeof UpdateProjectModelsSchema>;

// ==================== 转让所有权 DTOs ====================

/**
 * 转让项目所有权 DTO
 */
export const TransferOwnershipSchema = z.object({
  userId: z.string().uuid("用户ID格式不正确").describe("新所有者用户ID"),
});

export type TransferOwnershipDto = z.infer<typeof TransferOwnershipSchema>;

// ==================== 模板 DTOs ====================

/**
 * 模板内容
 */
export const TemplateContentSchema = z.object({
  characters: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        traits: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  scenes: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        atmosphere: z.string().optional(),
      }),
    )
    .optional(),
  scriptOutline: z
    .object({
      acts: z.number(),
      structure: z.string(),
    })
    .optional(),
});

export type TemplateContent = z.infer<typeof TemplateContentSchema>;

/**
 * 保存为模板 DTO
 */
export const SaveAsTemplateSchema = z.object({
  name: z.string().min(1).max(100).describe("模板名称"),
  description: z.string().max(500).optional().describe("模板描述"),
  content: TemplateContentSchema.describe("模板内容"),
  includeModelConfigs: z.boolean().default(true).describe("是否包含模型配置"),
  tags: z.array(z.string()).default([]).describe("标签"),
  isPublic: z.boolean().default(false).describe("是否公开"),
});

export type SaveAsTemplateDto = z.infer<typeof SaveAsTemplateSchema>;

/**
 * 从模板创建项目 DTO
 */
export const CreateFromTemplateSchema = z.object({
  name: z.string().min(2).max(50).describe("项目名称"),
  description: z.string().max(500).optional().describe("项目描述"),
  coverUrl: z.string().url().optional().describe("封面图URL"),
  includeModelConfigs: z
    .boolean()
    .default(true)
    .describe("是否使用模板模型配置"),
});

export type CreateFromTemplateDto = z.infer<typeof CreateFromTemplateSchema>;

/**
 * 查询模板列表参数
 */
export const QueryTemplatesSchema = z.object({
  type: z
    .enum([TemplateType.SYSTEM, TemplateType.USER])
    .optional()
    .describe("模板类型"),
  keyword: z.string().optional().describe("关键词搜索"),
  page: z.coerce.number().int().positive().default(1).describe("页码"),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(100)
    .default(20)
    .describe("每页数量"),
});

export type QueryTemplatesDto = z.infer<typeof QueryTemplatesSchema>;

// ==================== Response DTOs ====================

/**
 * 项目列表项响应
 */
export interface ProjectListItemDto {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  status: ProjectStatus;
  role: CollaboratorRole;
  owner: {
    id: string;
    username: string;
    avatar: string | null;
  };
  collaboratorCount: number;
  scriptCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * 项目详情响应
 */
export interface ProjectDetailDto {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  status: ProjectStatus;
  role: CollaboratorRole;
  owner: {
    id: string;
    username: string;
    avatar: string | null;
  };
  collaborators: Array<{
    id: string;
    username: string;
    avatar: string | null;
    role: CollaboratorRole;
    joinedAt: string;
  }>;
  defaultModels: Record<
    string,
    {
      modelId: string;
      modelName: string;
      providerName?: string;
    } | null
  >;
  stats: {
    scriptCount: number;
    characterCount: number;
    sceneCount: number;
    storyboardCount: number;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * 协作者响应
 */
export interface CollaboratorDto {
  id: string;
  username: string;
  avatar: string | null;
  role: CollaboratorRole;
  joinedAt: string;
}

/**
 * 邀请链接响应
 */
export interface InviteLinkDto {
  inviteCode: string;
  inviteUrl: string;
  role: CollaboratorRole;
  expiresAt: string;
  createdAt: string;
}

/**
 * 邀请链接列表项
 */
export interface InviteLinkListItemDto {
  inviteCode: string;
  role: CollaboratorRole;
  expiresAt: string;
  usedCount: number;
  maxUses: number;
  createdAt: string;
  revokedAt: string | null;
}

/**
 * 回收站项目
 */
export interface TrashProjectDto {
  id: string;
  name: string;
  coverUrl: string | null;
  deletedAt: string;
  willPermanentlyDeleteAt: string;
  daysRemaining: number;
}

/**
 * 模板响应
 */
export interface ProjectTemplateDto {
  id: string;
  templateId: string;
  name: string;
  description: string | null;
  type: TemplateType;
  creator: {
    id: string;
    username: string;
  } | null;
  content: TemplateContent;
  modelConfigs: Record<string, string> | null;
  tags: string[];
  usageCount: number;
  isPublic: boolean;
  status: TemplateStatus;
  createdAt: string;
}

// ==================== 项目统计 DTOs ====================

/**
 * 项目统计响应
 */
export interface ProjectStatsDto {
  scriptCount: number;
  characterCount: number;
  sceneCount: number;
  propCount: number;
}

/**
 * 最近剧本响应
 */
export interface RecentScriptDto {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  shotGroupReferenceImage: string | null;
  sceneReferenceImage: string | null;
  status: string;
  progress: number;
  updatedAt: string;
}

// ==================== 前端状态类型 ====================

/**
 * 项目状态（Pinia）
 */
export interface ProjectState {
  projects: ProjectListItemDto[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  loading: boolean;
  currentProject: ProjectDetailDto | null;
  collaborators: CollaboratorDto[];
  modelConfigs: Record<string, { modelId: string; modelName: string } | null>;
  inviteLinks: InviteLinkListItemDto[];
  trashProjects: TrashProjectDto[];
  templates: ProjectTemplateDto[];
  projectStats: ProjectStatsDto | null;
  recentScripts: RecentScriptDto[];
}
