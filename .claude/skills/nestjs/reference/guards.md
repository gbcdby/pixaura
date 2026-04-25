# Guards

Guards determine whether a request will be handled by the route handler based on conditions like permissions, roles, or authentication.

## Basic Guard

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    return validateRequest(request);
  }
}

function validateRequest(request: any): boolean {
  // Validate JWT, session, etc.
  return !!request.headers.authorization;
}
```

## JWT Auth Guard

```typescript
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
```

## Role-based Guard

```typescript
// Roles decorator
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

// Roles guard
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}

// Usage
@Controller('cats')
export class CatsController {
  @Post()
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  create(@Body() createCatDto: CreateCatDto) {}

  @Get()
  @Roles('admin', 'user')
  @UseGuards(JwtAuthGuard, RolesGuard)
  findAll() {}
}
```

## Permission-based Guard

```typescript
// Permissions decorator
export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

// Permissions guard
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    return requiredPermissions.every((permission) =>
      user.permissions?.includes(permission),
    );
  }
}

// Usage
@Controller('cats')
export class CatsController {
  @Post()
  @Permissions('cats:create')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  create(@Body() createCatDto: CreateCatDto) {}

  @Delete(':id')
  @Permissions('cats:delete')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  remove(@Param('id') id: string) {}
}
```

## API Key Guard

```typescript
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    const validApiKey = this.configService.get<string>('API_KEY');

    if (apiKey !== validApiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}
```

## Rate Limit Guard

```typescript
@Injectable()
export class RateLimitGuard implements CanActivate {
  private requests = new Map<string, number[]>();

  constructor(
    @Inject('RATE_LIMIT') private limit: number,
    @Inject('RATE_TTL') private ttl: number,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const key = request.ip;
    const now = Date.now();

    const timestamps = this.requests.get(key) || [];
    const validTimestamps = timestamps.filter((t) => now - t < this.ttl);

    if (validTimestamps.length >= this.limit) {
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    validTimestamps.push(now);
    this.requests.set(key, validTimestamps);

    return true;
  }
}
```

## Apply Guards

```typescript
// Method-scoped
@Get()
@UseGuards(AuthGuard)
findAll() {}

// Controller-scoped
@UseGuards(AuthGuard)
@Controller('cats')
export class CatsController {}

// Global (main.ts)
app.useGlobalGuards(new AuthGuard());

// Global with DI
@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}

// Multiple guards
@Post()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
create(@Body() createCatDto: CreateCatDto) {}
```

## Execution Context

```typescript
@Injectable()
export class UniversalGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // Get request type
    const requestType = context.getType(); // 'http' | 'ws' | 'rpc'

    if (requestType === 'http') {
      const request = context.switchToHttp().getRequest();
      // HTTP-specific logic
    } else if (requestType === 'ws') {
      const client = context.switchToWs().getClient();
      // WebSocket-specific logic
    } else if (requestType === 'rpc') {
      const data = context.switchToRpc().getData();
      // RPC-specific logic
    }

    return true;
  }
}
```

## Composite Decorator

```typescript
import { applyDecorators } from '@nestjs/common';

export function Auth(...roles: string[]) {
  return applyDecorators(
    SetMetadata('roles', roles),
    UseGuards(JwtAuthGuard, RolesGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Unauthorized' }),
  );
}

// Usage
@Controller('cats')
export class CatsController {
  @Post()
  @Auth('admin')
  create(@Body() createCatDto: CreateCatDto) {}
}
```

## Guard Execution Order

1. Global guards
2. Controller guards
3. Route guards
4. All guards must return `true` for the request to proceed
