# Shared Types (Zod Schemas)

This document describes the architecture for sharing DTOs between frontend and backend using Zod.

## Architecture Overview

```
my-project/
├── apps/
│   ├── api/                 # NestJS backend (imports from shared-types)
│   └── web/                 # Frontend app (imports from shared-types)
├── packages/
│   └── shared-types/        # Single source of truth for all DTOs
│       ├── src/
│       │   ├── cats/
│       │   ├── users/
│       │   └── index.ts
│       └── package.json
├── package.json
└── pnpm-workspace.yaml
```

## Package Setup

### shared-types/package.json

```json
{
  "name": "@myapp/shared-types",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}
```

### Root pnpm-workspace.yaml

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### Root package.json

```json
{
  "name": "myapp",
  "private": true,
  "scripts": {
    "build": "pnpm -r build",
    "dev": "pnpm -r --parallel dev",
    "test": "pnpm -r test"
  }
}
```

## Schema Patterns

### Basic Schema

```typescript
// packages/shared-types/src/users/user.schema.ts
import { z } from 'zod';

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(2).max(100),
  avatar: z.string().url().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type User = z.infer<typeof userSchema>;
```

### Create/Update Schemas

```typescript
// packages/shared-types/src/users/user.schema.ts
import { z } from 'zod';

// Base schema with common fields
const userBaseSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  avatar: z.string().url().optional(),
});

// Create schema (all fields required except optional ones)
export const createUserSchema = userBaseSchema;
export type CreateUserDto = z.infer<typeof createUserSchema>;

// Update schema (all fields optional)
export const updateUserSchema = userBaseSchema.partial();
export type UpdateUserDto = z.infer<typeof updateUserSchema>;

// Response schema (includes server-generated fields)
export const userResponseSchema = userBaseSchema.extend({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type UserResponse = z.infer<typeof userResponseSchema>;
```

### Enums

```typescript
// packages/shared-types/src/common/enums.ts
import { z } from 'zod';

export const UserRole = z.enum(['admin', 'user', 'guest']);
export type UserRole = z.infer<typeof UserRole>;

export const OrderStatus = z.enum([
  'pending',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
]);
export type OrderStatus = z.infer<typeof OrderStatus>;
```

### Nested Schemas

```typescript
// packages/shared-types/src/orders/order.schema.ts
import { z } from 'zod';
import { productSchema } from '../products/product.schema';

const orderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1),
  price: z.number().positive(),
  product: productSchema.optional(), // Nested
});

export const createOrderSchema = z.object({
  customerId: z.string().uuid(),
  items: z.array(orderItemSchema).min(1),
  shippingAddress: z.object({
    street: z.string(),
    city: z.string(),
    zipCode: z.string(),
    country: z.string(),
  }),
  notes: z.string().optional(),
});

export type CreateOrderDto = z.infer<typeof createOrderSchema>;
export type OrderItem = z.infer<typeof orderItemSchema>;
```

### Pagination Schemas

```typescript
// packages/shared-types/src/common/pagination.schema.ts
import { z } from 'zod';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function createPaginatedResponseSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
) {
  return z.object({
    data: z.array(itemSchema),
    meta: z.object({
      total: z.number().int(),
      page: z.number().int(),
      limit: z.number().int(),
      totalPages: z.number().int(),
      hasNextPage: z.boolean(),
      hasPrevPage: z.boolean(),
    }),
  });
}
```

### Form Validation Schemas

```typescript
// packages/shared-types/src/auth/login.schema.ts
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  rememberMe: z.boolean().default(false),
});

export type LoginDto = z.infer<typeof loginSchema>;
```

### API Response Schemas

```typescript
// packages/shared-types/src/common/api-response.schema.ts
import { z } from 'zod';

export const apiErrorSchema = z.object({
  statusCode: z.number(),
  message: z.string(),
  errors: z
    .array(
      z.object({
        field: z.string(),
        message: z.string(),
      }),
    )
    .optional(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export function createApiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.boolean(),
    data: dataSchema,
    message: z.string().optional(),
  });
}
```

## Backend Usage (apps/api)

### Install Shared Types

```bash
pnpm --filter @myapp/api add @myapp/shared-types
```

### Zod Validation Pipe

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

### Controller

```typescript
// apps/api/src/cats/cats.controller.ts
import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  createCatSchema,
  paginationQuerySchema,
  CreateCatDto,
  PaginationQuery,
} from '@myapp/shared-types';

@Controller('cats')
export class CatsController {
  @Post()
  create(
    @Body(new ZodValidationPipe(createCatSchema)) createCatDto: CreateCatDto,
  ) {
    return this.catsService.create(createCatDto);
  }

  @Get()
  findAll(
    @Query(new ZodValidationPipe(paginationQuerySchema))
    query: PaginationQuery,
  ) {
    return this.catsService.findAll(query);
  }
}
```

### Service

```typescript
// apps/api/src/cats/cats.service.ts
import { Injectable } from '@nestjs/common';
import { CreateCatDto, UpdateCatDto, PaginationQuery } from '@myapp/shared-types';

@Injectable()
export class CatsService {
  async create(createCatDto: CreateCatDto) {
    // createCatDto is fully typed and validated
    return this.catsRepository.create(createCatDto);
  }

  async findAll(query: PaginationQuery) {
    const { page, limit } = query;
    return this.catsRepository.find({
      skip: (page - 1) * limit,
      take: limit,
    });
  }
}
```

## Frontend Usage

### React Hook Form with Zod

```tsx
// apps/web/src/components/CatForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createCatSchema, CreateCatDto } from '@myapp/shared-types';

export function CatForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateCatDto>({
    resolver: zodResolver(createCatSchema),
  });

  const onSubmit = (data: CreateCatDto) => {
    api.cats.create(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name')} />
      {errors.name && <span>{errors.name.message}</span>}

      <input type="number" {...register('age', { valueAsNumber: true })} />
      {errors.age && <span>{errors.age.message}</span>}

      <button type="submit">Create Cat</button>
    </form>
  );
}
```

### API Client

```typescript
// apps/web/src/api/client.ts
import { CreateCatDto, CatResponse, createCatSchema } from '@myapp/shared-types';

export const api = {
  cats: {
    create: async (data: CreateCatDto): Promise<CatResponse> => {
      // Validate before sending (optional but recommended)
      const validated = createCatSchema.parse(data);

      const response = await fetch('/api/cats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
      });

      if (!response.ok) {
        throw new Error('Failed to create cat');
      }

      return response.json();
    },
  },
};
```

## Best Practices

### 1. Organize by Domain

```
packages/shared-types/src/
├── auth/
│   ├── login.schema.ts
│   ├── register.schema.ts
│   └── index.ts
├── users/
│   ├── user.schema.ts
│   └── index.ts
├── cats/
│   ├── cat.schema.ts
│   └── index.ts
├── common/
│   ├── pagination.schema.ts
│   └── api-response.schema.ts
└── index.ts
```

### 2. Export Patterns

```typescript
// index.ts - Always export both schema and type
export { userSchema, createUserSchema, updateUserSchema } from './user.schema';
export type { User, CreateUserDto, UpdateUserDto } from './user.schema';
```

### 3. Coerce for Query Params

```typescript
// Use z.coerce for query parameters (always strings)
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
```

### 4. Default Values

```typescript
export const createCatSchema = z.object({
  name: z.string().min(2),
  status: z.enum(['active', 'inactive']).default('active'),
  tags: z.array(z.string()).default([]),
});
```

### 5. Reusable Validators

```typescript
// common/validators.ts
export const emailSchema = z.string().email();
export const passwordSchema = z
  .string()
  .min(8)
  .regex(/[A-Z]/)
  .regex(/[a-z]/)
  .regex(/[0-9]/);
export const uuidSchema = z.string().uuid();

// Use in schemas
export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});
```

## Migration from class-validator

| class-validator | Zod |
|----------------|-----|
| `@IsString()` | `z.string()` |
| `@IsEmail()` | `z.string().email()` |
| `@IsNumber()` | `z.number()` |
| `@IsInt()` | `z.number().int()` |
| `@Min(0)` | `z.number().min(0)` |
| `@Max(100)` | `z.number().max(100)` |
| `@IsOptional()` | `.optional()` |
| `@IsEnum()` | `z.enum()` |
| `@IsArray()` | `z.array()` |
| `@ValidateNested()` | Nested schemas |
| `@IsUUID()` | `z.string().uuid()` |
| `@IsUrl()` | `z.string().url()` |
