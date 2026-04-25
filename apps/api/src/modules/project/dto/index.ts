/**
 * Project 模块 DTOs
 * 所有类型从 @pixaura/shared-types 导入，避免重复定义
 */

export {
  // Schemas
  CreateProjectSchema,
  UpdateProjectSchema,
  QueryProjectsSchema,
  InviteCollaboratorSchema,
  UpdateCollaboratorRoleSchema,
  CreateInviteLinkSchema,
  JoinProjectSchema,
  UpdateProjectModelsSchema,
  TransferOwnershipSchema,
  SaveAsTemplateSchema,
  CreateFromTemplateSchema,
  QueryTemplatesSchema,
  // DTO Types
  type CreateProjectDto,
  type UpdateProjectDto,
  type QueryProjectsDto,
  type InviteCollaboratorDto,
  type UpdateCollaboratorRoleDto,
  type CreateInviteLinkDto,
  type JoinProjectDto,
  type UpdateProjectModelsDto,
  type TransferOwnershipDto,
  type SaveAsTemplateDto,
  type CreateFromTemplateDto,
  type QueryTemplatesDto,
  type ProjectStatsDto,
  type RecentScriptDto,
} from "@pixaura/shared-types";
