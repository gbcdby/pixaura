import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers["x-internal-api-key"];

    if (!apiKey) {
      throw new ForbiddenException("缺少内部接口认证");
    }

    const validApiKey = this.configService.get<string>("internal.apiKey");
    if (apiKey !== validApiKey) {
      throw new ForbiddenException("内部接口认证失败");
    }

    return true;
  }
}
