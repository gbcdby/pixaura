# Custom Decorators

NestJS is built around decorators. You can create custom decorators for parameters, methods, and classes.

## Parameter Decorators

### Built-in Parameter Decorators

| Decorator | Description |
|-----------|-------------|
| `@Body()` | Request body |
| `@Param(key?)` | Route parameters |
| `@Query(key?)` | Query parameters |
| `@Headers(key?)` | Request headers |
| `@Req()` / `@Request()` | Express request object |
| `@Res()` / `@Response()` | Express response object |
| `@Session()` | Session object |
| `@Ip()` | Client IP address |
| `@HostParam()` | Host parameter |

### Custom Parameter Decorator

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const User = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);

// Usage
@Controller('cats')
export class CatsController {
  @Get()
  findAll(@User() user: UserEntity) {
    return `User: ${user.email}`;
  }

  @Get('email')
  getEmail(@User('email') email: string) {
    return `Email: ${email}`;
  }
}
```

### User Agent Decorator

```typescript
export const UserAgent = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.headers['user-agent'];
  },
);

// Usage
@Get()
findAll(@UserAgent() userAgent: string) {}
```

### Protocol Decorator

```typescript
export const Protocol = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.protocol;
  },
);

// Usage
@Get()
findAll(@Protocol() protocol: string) {}
```

## Method Decorators

### Roles Decorator

```typescript
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

// Usage
@Controller('cats')
export class CatsController {
  @Post()
  @Roles('admin')
  create(@Body() createCatDto: CreateCatDto) {}
}
```

### Permissions Decorator

```typescript
export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

// Usage
@Delete(':id')
@Permissions('cats:delete')
remove(@Param('id') id: string) {}
```

### Public Route Decorator

```typescript
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// Usage in guard
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // ... auth logic
  }
}

// Usage
@Controller('auth')
export class AuthController {
  @Post('login')
  @Public()
  login(@Body() loginDto: LoginDto) {}
}
```

## Class Decorators

### Custom Controller Decorator

```typescript
import { Controller, applyDecorators } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

export function ApiController(path: string, tag: string) {
  return applyDecorators(
    Controller(path),
    ApiTags(tag),
  );
}

// Usage
@ApiController('cats', 'Cats')
export class CatsController {}
```

## Decorator Composition

### Auth Decorator

```typescript
import { applyDecorators, UseGuards, SetMetadata } from '@nestjs/common';
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

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

  @Get()
  @Auth('admin', 'user')
  findAll() {}
}
```

### Cache Decorator

```typescript
import { applyDecorators, UseInterceptors, SetMetadata } from '@nestjs/common';

export const CACHE_KEY_METADATA = 'cache_key';
export const CACHE_TTL_METADATA = 'cache_ttl';

export interface CacheOptions {
  key?: string;
  ttl?: number;
}

export function Cache(options: CacheOptions = {}) {
  return applyDecorators(
    SetMetadata(CACHE_KEY_METADATA, options.key),
    SetMetadata(CACHE_TTL_METADATA, options.ttl),
    UseInterceptors(CacheInterceptor),
  );
}

// Usage
@Controller('cats')
export class CatsController {
  @Get()
  @Cache({ key: 'cats-list', ttl: 60000 })
  findAll() {}
}
```

### Pagination Decorator

```typescript
export interface PaginationParams {
  page: number;
  limit: number;
}

export const Pagination = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): PaginationParams => {
    const request = ctx.switchToHttp().getRequest();
    const page = parseInt(request.query.page, 10) || 1;
    const limit = parseInt(request.query.limit, 10) || 10;

    return { page, limit };
  },
);

// Usage
@Get()
findAll(@Pagination() pagination: PaginationParams) {
  const { page, limit } = pagination;
  return this.catsService.findAll({ skip: (page - 1) * limit, take: limit });
}
```

## File Upload Decorators

```typescript
export const UploadedFiles = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.files;
  },
);

// Usage
@Post('upload')
@UseInterceptors(FilesInterceptor('files'))
uploadFiles(@UploadedFiles() files: Express.Multer.File[]) {
  return files.map((file) => file.filename);
}
```

## Working with Pipes

```typescript
export const Validate = createParamDecorator(
  (schema: Joi.ObjectSchema, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const { error, value } = schema.validate(request.body);

    if (error) {
      throw new BadRequestException(error.message);
    }

    return value;
  },
);

// Usage
const createCatSchema = Joi.object({
  name: Joi.string().required(),
  age: Joi.number().integer().min(0).required(),
});

@Post()
create(@Validate(createCatSchema) createCatDto: CreateCatDto) {}
```

## Reflector Usage

```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get from handler (method)
    const handlerRoles = this.reflector.get<string[]>('roles', context.getHandler());

    // Get from class (controller)
    const classRoles = this.reflector.get<string[]>('roles', context.getClass());

    // Get from both (handler overrides class)
    const roles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    // Merge all
    const allRoles = this.reflector.getAllAndMerge<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    // ...
  }
}
```
