import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { ProjectService } from "../services/project.service";

/**
 * 项目成员权限验证 Guard
 * 验证当前用户是否为项目成员
 */
@Injectable()
export class ProjectGuard implements CanActivate {
  constructor(private readonly projectService: ProjectService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const user = request.user as { userId: string } | undefined;
    const params = request.params as Record<string, string>;

    if (!user?.userId) {
      throw new ForbiddenException("未登录");
    }

    // 优先检查 camelCase，然后 snake_case
    const projectId = params.projectId || params.project_id || params.id;

    if (!projectId) {
      return true; // 没有 projectId 的路由跳过检查
    }

    const role = await this.projectService.getUserRole(projectId, user.userId);

    if (!role) {
      throw new NotFoundException("项目不存在或无访问权限");
    }

    // 将角色附加到请求对象
    (request as unknown as Record<string, unknown>).projectRole = role;

    return true;
  }
}

/**
 * 项目所有者权限验证 Guard
 * 验证当前用户是否为项目所有者
 */
@Injectable()
export class OwnerGuard implements CanActivate {
  constructor(private readonly projectService: ProjectService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const user = request.user as { userId: string } | undefined;
    const params = request.params as Record<string, string>;

    if (!user?.userId) {
      throw new ForbiddenException("未登录");
    }

    // 优先检查 camelCase，然后 snake_case
    const projectId = params.projectId || params.project_id || params.id;

    if (!projectId) {
      throw new ForbiddenException("缺少项目ID");
    }

    const role = await this.projectService.getUserRole(projectId, user.userId);

    if (role !== "owner") {
      throw new ForbiddenException("仅项目所有者可执行此操作");
    }

    return true;
  }
}

/**
 * 项目编辑者权限验证 Guard
 * 验证当前用户是否为项目所有者或编辑者
 */
@Injectable()
export class EditorGuard implements CanActivate {
  constructor(private readonly projectService: ProjectService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const user = request.user as { userId: string } | undefined;
    const params = request.params as Record<string, string>;

    if (!user?.userId) {
      throw new ForbiddenException("未登录");
    }

    // 优先检查 camelCase，然后 snake_case
    const projectId = params.projectId || params.project_id || params.id;

    if (!projectId) {
      throw new ForbiddenException("缺少项目ID");
    }

    const role = await this.projectService.getUserRole(projectId, user.userId);

    if (role !== "owner" && role !== "editor") {
      throw new ForbiddenException("仅项目所有者或编辑者可执行此操作");
    }

    return true;
  }
}
