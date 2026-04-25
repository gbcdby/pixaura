# Controllers

Controllers handle incoming HTTP requests and return responses. This project uses Zod schemas from `@myapp/shared-types` for validation.

## Basic Controller

```typescript
import { Controller, Get } from '@nestjs/common';

@Controller('cats')
export class CatsController {
  @Get()
  findAll(): string {
    return 'This action returns all cats';
  }
}
```

## HTTP Method Decorators

```typescript
@Controller('cats')
export class CatsController {
  @Get()           // GET /cats
  findAll() {}

  @Post()          // POST /cats
  create() {}

  @Get(':id')      // GET /cats/:id
  findOne() {}

  @Put(':id')      // PUT /cats/:id
  update() {}

  @Patch(':id')    // PATCH /cats/:id
  partialUpdate() {}

  @Delete(':id')   // DELETE /cats/:id
  remove() {}

  @All()           // All HTTP methods
  handleAll() {}
}
```

## Parameter Decorators

```typescript
@Controller('cats')
export class CatsController {
  @Post()
  create(
    @Body() createCatDto: CreateCatDto,                    // Full body
    @Body('name') name: string,                            // Specific property
  ) {}

  @Get(':id')
  findOne(
    @Param('id') id: string,                               // Route param
    @Query() query: any,                                   // Query params
    @Query('limit') limit: number,                         // Specific query
  ) {}

  @Get()
  findAll(
    @Headers() headers: any,                               // All headers
    @Headers('authorization') auth: string,                // Specific header
    @Ip() ip: string,                                      // Client IP
    @HostParam() host: string,                             // Host param
    @Req() req: Request,                                   // Express request
    @Res({ passthrough: true }) res: Response,             // Express response
  ) {}
}
```

## Validation with Zod (Shared Types)

### Body Validation

```typescript
import { Controller, Post, Body, UsePipes } from '@nestjs/common';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { createCatSchema, CreateCatDto } from '@myapp/shared-types';

@Controller('cats')
export class CatsController {
  constructor(private catsService: CatsService) {}

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
    return this.catsService.findAll({ page, limit });
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

## Response Control

```typescript
@Controller('cats')
export class CatsController {
  // Custom status code
  @Post()
  @HttpCode(201)
  create() {}

  // Custom headers
  @Get()
  @Header('Cache-Control', 'none')
  findAll() {}

  // Redirect
  @Get('docs')
  @Redirect('https://docs.nestjs.com', 302)
  getDocs() {}

  // Conditional redirect
  @Get('docs')
  @Redirect('https://docs.nestjs.com')
  getDocs(@Query('version') version) {
    if (version && version === '5') {
      return { url: 'https://docs.nestjs.com/v5/' };
    }
  }
}
```

## Route Patterns

```typescript
@Controller('cats')
export class CatsController {
  // Wildcard
  @Get('ab*cd')  // Matches abcd, ab_cd, abecd, etc.
  wildcard() {}

  // Multiple segments
  @Get('breed/:breed/:id')
  findByBreed(@Param('breed') breed: string, @Param('id') id: string) {}
}
```

## Asynchronous Handlers

```typescript
@Controller('cats')
export class CatsController {
  // Promise
  @Get()
  async findAll(): Promise<Cat[]> {
    return this.catsService.findAll();
  }

  // Observable
  @Get()
  findAll(): Observable<Cat[]> {
    return this.catsService.findAll();
  }
}
```

## Sub-Domain Routing

```typescript
@Controller({ host: 'admin.example.com' })
export class AdminController {
  @Get()
  index(): string {
    return 'Admin page';
  }
}

// Dynamic sub-domain
@Controller({ host: ':account.example.com' })
export class AccountController {
  @Get()
  getInfo(@HostParam('account') account: string) {
    return account;
  }
}
```

## Request/Response Objects

```typescript
@Controller('cats')
export class CatsController {
  @Get()
  findAll(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    // Access request
    console.log(request.headers);

    // Modify response (with passthrough, Nest handles it)
    response.status(200);
    return this.catsService.findAll();
  }

  // Library-specific approach (Express)
  @Get()
  findAll(@Res() res: Response) {
    res.status(200).send(this.catsService.findAll());
  }
}
```

## Full CRUD Example with Zod

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  UsePipes,
} from '@nestjs/common';
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
  @HttpCode(201)
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
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.catsService.remove(id);
  }
}
```

## Scoped Controllers

```typescript
@Controller({
  path: 'cats',
  scope: Scope.REQUEST,  // New instance per request
})
export class CatsController {}
```

## Important Notes

### ❌ Never Define DTOs in Backend

```typescript
// ❌ DON'T DO THIS
// apps/api/src/cats/dto/create-cat.dto.ts
import { IsString, IsInt } from 'class-validator';

export class CreateCatDto {
  @IsString()
  name: string;

  @IsInt()
  age: number;
}
```

### ✅ Always Import from Shared Types

```typescript
// ✅ DO THIS
import { createCatSchema, CreateCatDto } from '@myapp/shared-types';
```
