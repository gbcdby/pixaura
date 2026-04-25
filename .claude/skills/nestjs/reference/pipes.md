# Pipes

Pipes transform input data or validate it before it reaches the route handler. This project uses Zod schemas from `@myapp/shared-types` for validation.

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

## Using Pipes

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

@Controller('cats')
export class CatsController {
  @Get(':id')
  findOne(@Param() params: { id: string }) {
    const validated = catIdSchema.parse(params);
    return this.catsService.findOne(validated.id);
  }
}
```

## Parse Pipes

### ParseIntPipe (Zod version)

```typescript
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { z } from 'zod';

@Injectable()
export class ParseIntPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    const result = z.coerce.number().int().safeParse(value);

    if (!result.success) {
      throw new BadRequestException(`"${value}" is not a valid integer`);
    }

    return result.data;
  }
}

// Usage
@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) {}
```

### ParseUUIDPipe (Zod version)

```typescript
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { z } from 'zod';

@Injectable()
export class ParseUUIDPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    const result = z.string().uuid().safeParse(value);

    if (!result.success) {
      throw new BadRequestException(`"${value}" is not a valid UUID`);
    }

    return result.data;
  }
}

// Usage
@Get(':id')
findOne(@Param('id', ParseUUIDPipe) id: string) {}
```

### ParseEnumPipe (Zod version)

```typescript
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { z } from 'zod';

@Injectable()
export class ParseEnumPipe<T extends string>
  implements PipeTransform<string, T> {
  constructor(private enumValues: T[]) {}

  transform(value: string): T {
    const schema = z.enum(this.enumValues as [T, ...T[]]);
    const result = schema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException(
        `"${value}" is not a valid enum value. Allowed: ${this.enumValues.join(', ')}`,
      );
    }

    return result.data;
  }
}

// Usage
enum CatStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Get()
findByStatus(@Query('status', new ParseEnumPipe(Object.values(CatStatus))) status: CatStatus) {}
```

### DefaultValuePipe (Zod version)

```typescript
import { PipeTransform, Injectable } from '@nestjs/common';
import { z } from 'zod';

@Injectable()
export class DefaultValuePipe<T> implements PipeTransform<T, T> {
  constructor(private defaultValue: T) {}

  transform(value: T): T {
    return value ?? this.defaultValue;
  }
}

// Usage
@Get()
findAll(
  @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
) {}
```

## Custom Pipes

### File Size Validation Pipe

```typescript
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

export interface FileSizeValidationPipeOptions {
  maxSize: number; // in bytes
}

@Injectable()
export class FileSizeValidationPipe implements PipeTransform {
  constructor(private options: FileSizeValidationPipeOptions) {}

  transform(value: Express.Multer.File) {
    if (value.size > this.options.maxSize) {
      throw new BadRequestException(
        `File too large. Max size is ${this.options.maxSize / 1024 / 1024}MB`,
      );
    }
    return value;
  }
}

// Usage
@Post('upload')
@UseInterceptors(FileInterceptor('file'))
uploadFile(
  @UploadedFile(new FileSizeValidationPipe({ maxSize: 5 * 1024 * 1024 }))
  file: Express.Multer.File,
) {
  return { filename: file.filename };
}
```

### File Type Validation Pipe

```typescript
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class FileTypeValidationPipe implements PipeTransform {
  constructor(private allowedTypes: string[]) {}

  transform(value: Express.Multer.File) {
    if (!this.allowedTypes.includes(value.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed: ${this.allowedTypes.join(', ')}`,
      );
    }
    return value;
  }
}

// Usage
@Post('upload')
@UseInterceptors(FileInterceptor('file'))
uploadFile(
  @UploadedFile(
    new FileTypeValidationPipe(['image/jpeg', 'image/png', 'image/gif']),
  )
  file: Express.Multer.File,
) {}
```

## Apply Pipes

### Method-scoped

```typescript
@Post()
@UsePipes(new ZodValidationPipe(createCatSchema))
create(@Body() createCatDto: CreateCatDto) {}
```

### Parameter-scoped

```typescript
@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) {}
```

### Controller-scoped

```typescript
@UsePipes(new ZodValidationPipe(someSchema))
@Controller('cats')
export class CatsController {}
```

### Global (main.ts)

```typescript
// Note: With Zod, we typically apply pipes per-route
// Global pipes can be used for common transformations

app.useGlobalPipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
  }),
);
```

## Combining Pipes

```typescript
@Controller('cats')
export class CatsController {
  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('status', new ParseEnumPipe(['active', 'inactive']))
    status?: string,
  ) {
    return this.catsService.findAll({ page, limit, status });
  }
}
```

## Best Practices

1. **Use ZodValidationPipe with shared schemas** - Single source of truth
2. **Use coerce for query params** - They come as strings from HTTP
3. **Use safeParse for manual validation** - Avoid exceptions when possible
4. **Create reusable parse pipes** - ParseIntPipe, ParseUUIDPipe, etc.
5. **Apply pipes at the right level** - Parameter > Method > Controller > Global
