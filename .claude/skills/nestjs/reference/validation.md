# Validation with Zod

This project uses Zod for schema validation with shared DTOs between frontend and backend.

## Architecture

```
my-project/
├── apps/
│   └── api/                 # NestJS backend (uses ZodValidationPipe)
├── packages/
│   └── shared-types/        # All Zod schemas and types
```

**Rule**: Never define DTOs in the backend. Always import from `@myapp/shared-types`.

## Zod Validation Pipe

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

## Using Validation in Controllers

### Body Validation

```typescript
import { Controller, Post, Body, UsePipes } from '@nestjs/common';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { createCatSchema, CreateCatDto } from '@myapp/shared-types';

@Controller('cats')
export class CatsController {
  @Post()
  @UsePipes(new ZodValidationPipe(createCatSchema))
  create(@Body() createCatDto: CreateCatDto) {
    return this.catsService.create(createCatDto);
  }
}
```

### Query Validation

```typescript
import { Controller, Get, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { paginationQuerySchema, PaginationQuery } from '@myapp/shared-types';

@Controller('cats')
export class CatsController {
  @Get()
  findAll(
    @Query(new ZodValidationPipe(paginationQuerySchema))
    query: PaginationQuery,
  ) {
    const { page, limit } = query;
    return this.catsService.findAll({ skip: (page - 1) * limit, take: limit });
  }
}
```

### Param Validation

```typescript
import { Controller, Get, Param } from '@nestjs/common';
import { z } from 'zod';

const catIdSchema = z.object({
  id: z.string().uuid(),
});

type CatIdParam = z.infer<typeof catIdSchema>;

@Controller('cats')
export class CatsController {
  @Get(':id')
  findOne(@Param() params: CatIdParam) {
    const { id } = catIdSchema.parse(params);
    return this.catsService.findOne(id);
  }
}
```

## Common Zod Patterns

### Basic Types

```typescript
import { z } from 'zod';

// String
const nameSchema = z.string();
const emailSchema = z.string().email();
const urlSchema = z.string().url();
const uuidSchema = z.string().uuid();

// Number
const ageSchema = z.number();
const positiveSchema = z.number().positive();
const intSchema = z.number().int();
const rangedSchema = z.number().min(0).max(100);

// Boolean
const activeSchema = z.boolean();

// Date
const dateSchema = z.date();
const dateStringSchema = z.string().datetime();

// Array
const tagsSchema = z.array(z.string());
const uniqueTagsSchema = z.array(z.string()).unique();
```

### Objects

```typescript
import { z } from 'zod';

const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(2).max(100),
  age: z.number().int().min(0).optional(),
  isActive: z.boolean().default(true),
  role: z.enum(['admin', 'user', 'guest']).default('user'),
  metadata: z.record(z.unknown()).optional(),
});

type User = z.infer<typeof userSchema>;
```

### Optional and Default

```typescript
const schema = z.object({
  required: z.string(),                    // Required
  optional: z.string().optional(),         // Optional (undefined allowed)
  nullable: z.string().nullable(),         // Nullable (null allowed)
  withDefault: z.string().default('foo'),  // With default value
});
```

### Coercion (for query params)

```typescript
// Query params are always strings, use coerce
const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  active: z.coerce.boolean().default(true),
});
```

### Arrays

```typescript
const schema = z.object({
  tags: z.array(z.string()),
  scores: z.array(z.number().min(0).max(100)),
  uniqueItems: z.array(z.string()).unique(),
  minItems: z.array(z.string()).min(1),
  maxItems: z.array(z.string()).max(10),
  exactItems: z.array(z.string()).length(5),
});
```

### Nested Objects

```typescript
const addressSchema = z.object({
  street: z.string(),
  city: z.string(),
  zipCode: z.string(),
  country: z.string(),
});

const userSchema = z.object({
  name: z.string(),
  address: addressSchema,
  previousAddresses: z.array(addressSchema),
});
```

### Transformations

```typescript
const schema = z.object({
  // Trim string
  name: z.string().trim(),

  // Transform to lowercase
  email: z.string().email().toLowerCase(),

  // Custom transform
  phone: z
    .string()
    .transform((val) => val.replace(/\D/g, ''))
    .refine((val) => val.length === 10, 'Invalid phone number'),
});
```

### Refinements (Custom Validation)

```typescript
const passwordSchema = z
  .string()
  .min(8)
  .refine((val) => /[A-Z]/.test(val), {
    message: 'Must contain at least one uppercase letter',
  })
  .refine((val) => /[a-z]/.test(val), {
    message: 'Must contain at least one lowercase letter',
  })
  .refine((val) => /[0-9]/.test(val), {
    message: 'Must contain at least one number',
  });

// Custom refinement with params
const confirmPasswordSchema = z
  .object({
    password: z.string(),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });
```

## CRUD Schemas Pattern

```typescript
// packages/shared-types/src/cats/cat.schema.ts
import { z } from 'zod';

// Base schema with common fields
const catBaseSchema = z.object({
  name: z.string().min(2).max(50),
  age: z.number().int().min(0).max(30),
  breed: z.string().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
  tags: z.array(z.string()).default([]),
});

// Create (all required except optional ones)
export const createCatSchema = catBaseSchema;
export type CreateCatDto = z.infer<typeof createCatSchema>;

// Update (all fields optional)
export const updateCatSchema = catBaseSchema.partial();
export type UpdateCatDto = z.infer<typeof updateCatSchema>;

// Response (includes server-generated fields)
export const catResponseSchema = catBaseSchema.extend({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CatResponse = z.infer<typeof catResponseSchema>;

// Query params
export const catQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});
export type CatQuery = z.infer<typeof catQuerySchema>;
```

## Global Validation Setup

```typescript
// apps/api/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Zod validation is applied per-route using ZodValidationPipe
  // No global pipe needed - use @UsePipes() on controllers/routes

  await app.listen(3000);
}
bootstrap();
```

## Error Response Format

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email address"
    },
    {
      "field": "age",
      "message": "Number must be less than or equal to 30"
    }
  ]
}
```

## Best Practices

1. **Define all schemas in shared-types** - Never in backend or frontend
2. **Export both schema and type** - `export const schema` + `export type Schema`
3. **Use `.coerce()` for query params** - They come as strings
4. **Set sensible defaults** - Use `.default()` for optional fields
5. **Use `.trim()` on strings** - Clean user input
6. **Add custom error messages** - Better UX
7. **Use `.safeParse()` for manual validation** - Avoid throwing

## Comparison with class-validator

| class-validator | Zod | Use Case |
|----------------|-----|----------|
| `@IsString()` | `z.string()` | String validation |
| `@IsEmail()` | `z.string().email()` | Email validation |
| `@IsNumber()` | `z.number()` | Number validation |
| `@IsInt()` | `z.number().int()` | Integer validation |
| `@Min(0)` | `z.number().min(0)` | Minimum value |
| `@Max(100)` | `z.number().max(100)` | Maximum value |
| `@IsOptional()` | `.optional()` | Optional field |
| `@IsEnum()` | `z.enum()` | Enum validation |
| `@IsArray()` | `z.array()` | Array validation |
| `@ValidateNested()` | Nested schemas | Object validation |
| `@IsUUID()` | `z.string().uuid()` | UUID validation |
| `@IsUrl()` | `z.string().url()` | URL validation |
| `@Length(2, 50)` | `z.string().min(2).max(50)` | String length |
| `@IsBoolean()` | `z.boolean()` | Boolean validation |
| `@IsDate()` | `z.date()` | Date validation |
