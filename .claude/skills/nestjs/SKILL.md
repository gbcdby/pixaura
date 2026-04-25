---
name: nestjs
description: A progressive Node.js framework for building efficient, scalable server-side applications. Uses TypeScript with decorators, dependency injection, and modular architecture. Uses Zod for validation with shared DTOs.
---

# NestJS Skill

**Stack**: Node.js + TypeScript + Express/Fastify + Zod

## Overview

NestJS is a framework for building efficient, scalable server-side applications. This skill uses:
- **Zod** for schema validation (shared DTOs with frontend)
- **Monorepo structure** with shared types package

## Project Structure

```
my-project/
├── apps/
│   └── api/                         # NestJS backend
│       ├── src/
│       │   ├── cats/
│       │   │   ├── cats.controller.ts
│       │   │   ├── cats.service.ts
│       │   │   └── cats.module.ts
│       │   ├── common/
│       │   │   └── pipes/
│       │   │       └── zod-validation.pipe.ts
│       │   ├── app.module.ts
│       │   └── main.ts
│       ├── package.json
│       └── nest-cli.json
├── packages/
│   └── shared-types/                # Shared DTOs (Zod schemas)
│       ├── src/
│       │   ├── cats/
│       │   │   ├── cat.schema.ts
│       │   │   └── index.ts
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── package.json
└── pnpm-workspace.yaml
```

## Quick Start

### 1. Create NestJS App

```bash
cd apps
nest new api --strict --package-manager npm
```

### 2. Install Dependencies

```bash
cd apps/api

# Install shared types and zod
pnpm add @myapp/shared-types zod
```

### 3. Create Zod Validation Pipe

```typescript
// apps/api/src/common/pipes/zod-validation.pipe.ts
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      const errors = result.error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      throw new BadRequestException({
        message: 'Validation failed',
        errors,
      });
    }

    return result.data;
  }
}
```

### 4. Create Controller with Zod

```typescript
// apps/api/src/cats/cats.controller.ts
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UsePipes } from '@nestjs/common';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  createCatSchema,
  updateCatSchema,
  paginationQuerySchema,
  CreateCatDto,
  UpdateCatDto,
  PaginationQuery,
} from '@myapp/shared-types';

@Controller('cats')
export class CatsController {
  constructor(private catsService: CatsService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(createCatSchema))
  create(@Body() createCatDto: CreateCatDto) {
    return this.catsService.create(createCatDto);
  }

  @Get()
  findAll(
    @Query(new ZodValidationPipe(paginationQuerySchema))
    query: PaginationQuery,
  ) {
    return this.catsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.catsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCatSchema)) updateCatDto: UpdateCatDto,
  ) {
    return this.catsService.update(id, updateCatDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.catsService.remove(id);
  }
}
```

## Core Concepts

| Concept | Purpose | File |
|---------|---------|------|
| **Controllers** | Handle HTTP requests/responses | [reference/controllers.md](reference/controllers.md) |
| **Providers** | Business logic, services | [reference/providers.md](reference/providers.md) |
| **Modules** | Application structure | [reference/modules.md](reference/modules.md) |
| **Middleware** | Pre-route request processing | [reference/middleware.md](reference/middleware.md) |
| **Exception Filters** | Error handling | [reference/exception-filters.md](reference/exception-filters.md) |
| **Pipes** | Data transformation/validation (Zod) | [reference/pipes.md](reference/pipes.md) |
| **Guards** | Authorization | [reference/guards.md](reference/guards.md) |
| **Interceptors** | Response transformation | [reference/interceptors.md](reference/interceptors.md) |
| **Decorators** | Custom decorators | [reference/decorators.md](reference/decorators.md) |

## Advanced Topics

| Topic | Description | File |
|-------|-------------|------|
| **Shared Types** | Zod schemas shared with frontend | [reference/shared-types.md](reference/shared-types.md) |
| **Dependency Injection** | Provider patterns | [reference/dependency-injection.md](reference/dependency-injection.md) |
| **Configuration** | Environment config | [reference/configuration.md](reference/configuration.md) |
| **Validation** | Zod validation patterns | [reference/validation.md](reference/validation.md) |
| **Database** | Database integration | [reference/database.md](reference/database.md) |
| **Testing** | Unit and E2E testing | [reference/testing.md](reference/testing.md) |
| **OpenAPI** | API documentation | [reference/openapi.md](reference/openapi.md) |
| **CLI** | CLI commands | [reference/cli.md](reference/cli.md) |

## Shared Types Architecture

### Rule: No Private DTOs

**Never define DTOs in backend or frontend:**
```typescript
// ❌ DON'T: apps/api/src/cats/dto/create-cat.dto.ts
export class CreateCatDto {
  @IsString()
  name: string;
}
```

**Always use shared types:**
```typescript
// ✅ DO: import from shared-types
import { createCatSchema } from '@myapp/shared-types';
```

### Benefits

1. **Single source of truth** - One schema for both frontend and backend
2. **Type safety** - TypeScript types inferred from Zod schemas
3. **Runtime validation** - Validation works at runtime
4. **No decorator overhead** - Clean, readable schemas
5. **Easy to maintain** - Changes sync automatically

## Best Practices

1. **All DTOs in shared-types** - Never define locally
2. **Use Zod for everything** - Forms, APIs, config validation
3. **Export both schema and type** - `export const schema` + `export type Schema`
4. **Version shared-types** - Track changes with semver

## Reference

- [Official Documentation](https://docs.nestjs.com/)
- [Zod Documentation](https://zod.dev/)
- [API Reference](https://api-references-nestjs.netlify.app/)

## Internal Reference

- [Controllers](reference/controllers.md) - HTTP request handling
- [Providers](reference/providers.md) - Services and DI
- [Modules](reference/modules.md) - Application structure
- [Middleware](reference/middleware.md) - Request preprocessing
- [Exception Filters](reference/exception-filters.md) - Error handling
- [Pipes](reference/pipes.md) - Zod validation pipes
- [Guards](reference/guards.md) - Authorization
- [Interceptors](reference/interceptors.md) - Response transformation
- [Decorators](reference/decorators.md) - Custom decorators
- [Shared Types](reference/shared-types.md) - Shared DTOs architecture
- [Dependency Injection](reference/dependency-injection.md) - DI patterns
- [Configuration](reference/configuration.md) - Environment config
- [Validation](reference/validation.md) - Zod validation
- [Database](reference/database.md) - Database integration
- [Testing](reference/testing.md) - Unit and E2E testing
- [OpenAPI](reference/openapi.md) - API documentation
- [CLI](reference/cli.md) - CLI commands
