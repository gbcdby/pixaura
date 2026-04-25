# OpenAPI (Swagger)

NestJS provides a dedicated module for generating OpenAPI (Swagger) documentation. Works with Zod schemas.

## Installation

```bash
pnpm add @nestjs/swagger swagger-ui-express
```

## Basic Setup

```typescript
// apps/api/src/main.ts
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('Cats API')
    .setDescription('The cats API description')
    .setVersion('1.0')
    .addTag('cats')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(3000);
}
bootstrap();
```

## Document Builder Options

```typescript
const config = new DocumentBuilder()
  .setTitle('Cats API')
  .setDescription('The cats API description')
  .setVersion('1.0')
  .setContact('Author', 'https://example.com', 'email@example.com')
  .setLicense('MIT', 'https://opensource.org/licenses/MIT')
  .setTermsOfService('https://example.com/terms')
  .addTag('cats', 'Cat operations')
  .addTag('dogs', 'Dog operations')
  .addBearerAuth()  // JWT auth
  .addApiKey({ type: 'apiKey', name: 'X-API-KEY', in: 'header' })
  .addBasicAuth()
  .addOAuth2()
  .addServer('https://api.example.com/v1')
  .addServer('https://staging-api.example.com/v1')
  .build();
```

## Controller Decorators

```typescript
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { createCatSchema, CreateCatDto, CatResponse } from '@myapp/shared-types';

@ApiTags('cats')
@ApiBearerAuth()
@Controller('cats')
export class CatsController {
  constructor(private readonly catsService: CatsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new cat' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Whiskers' },
        age: { type: 'integer', example: 2 },
        breed: { type: 'string', example: 'Persian' },
      },
      required: ['name', 'age'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'The cat has been created',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        age: { type: 'integer' },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Body() createCatDto: CreateCatDto) {
    return this.catsService.create(createCatDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all cats' })
  @ApiResponse({
    status: 200,
    description: 'Returns all cats',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              age: { type: 'integer' },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'integer' },
            page: { type: 'integer' },
            limit: { type: 'integer' },
          },
        },
      },
    },
  })
  findAll(@Query() query: PaginationQuery) {
    return this.catsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a cat by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Cat ID' })
  @ApiResponse({ status: 200, description: 'Returns the cat' })
  @ApiResponse({ status: 404, description: 'Cat not found' })
  findOne(@Param('id') id: string) {
    return this.catsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a cat' })
  @ApiResponse({ status: 200, description: 'Cat updated' })
  @ApiResponse({ status: 404, description: 'Cat not found' })
  update(@Param('id') id: string, @Body() updateCatDto: UpdateCatDto) {
    return this.catsService.update(id, updateCatDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a cat' })
  @ApiResponse({ status: 204, description: 'Cat deleted' })
  remove(@Param('id') id: string) {
    return this.catsService.remove(id);
  }
}
```

## Authentication

### Bearer Auth (JWT)

```typescript
// apps/api/src/main.ts
const config = new DocumentBuilder()
  .addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'JWT',
      description: 'Enter JWT token',
      in: 'header',
    },
    'JWT-auth',
  )
  .build();

// Controller
@ApiBearerAuth('JWT-auth')
@Controller('cats')
export class CatsController {}
```

### API Key Auth

```typescript
// apps/api/src/main.ts
const config = new DocumentBuilder()
  .addApiKey(
    { type: 'apiKey', name: 'X-API-KEY', in: 'header' },
    'ApiKeyAuth',
  )
  .build();

// Controller
@ApiSecurity('ApiKeyAuth')
@Controller('cats')
export class CatsController {}
```

### Basic Auth

```typescript
const config = new DocumentBuilder()
  .addBasicAuth({ type: 'http', scheme: 'basic' }, 'basic')
  .build();

// Controller
@ApiBasicAuth()
@Controller('cats')
export class CatsController {}
```

## File Upload

```typescript
@Controller('cats')
export class CatsController {
  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        name: {
          type: 'string',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { name: string },
  ) {}
}
```

## Custom Decorators

```typescript
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

export function ApiStandardResponse(options: {
  status?: number;
  description?: string;
}) {
  return applyDecorators(
    ApiResponse({
      status: options.status || 200,
      description: options.description || 'Success',
    }),
    ApiResponse({ status: 400, description: 'Bad Request' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 500, description: 'Internal Server Error' }),
  );
}

// Usage
@Get()
@ApiOperation({ summary: 'Get all cats' })
@ApiStandardResponse({ description: 'Returns all cats' })
findAll() {}
```

## Document Options

```typescript
const documentOptions: SwaggerDocumentOptions = {
  operationIdFactory: (controllerKey: string, methodKey: string) =>
    `${controllerKey}_${methodKey}`,
  include: [CatsModule, DogsModule],  // Only include specific modules
  deepScanRoutes: true,
};

const document = SwaggerModule.createDocument(app, config, documentOptions);
```

## Custom Swagger UI

```typescript
SwaggerModule.setup('api', app, document, {
  swaggerOptions: {
    persistAuthorization: true,
    docExpansion: 'none',
    filter: true,
    showRequestDuration: true,
  },
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'My API Documentation',
  customfavIcon: '/favicon.ico',
});
```

## Export Document

```typescript
// Save as JSON
import * as fs from 'fs';

const document = SwaggerModule.createDocument(app, config);
fs.writeFileSync('./swagger-spec.json', JSON.stringify(document));

// Or serve as JSON
app.get('/api-json', (req, res) => {
  res.json(document);
});
```

## Zod to OpenAPI (Optional)

If you want to generate OpenAPI specs from Zod schemas, you can use `zod-to-openapi`:

```bash
pnpm add @asteasolutions/zod-to-openapi
```

```typescript
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

// Now your Zod schemas have OpenAPI metadata
export const createCatSchema = z.object({
  name: z.string().openapi({ example: 'Whiskers' }),
  age: z.number().int().openapi({ example: 2 }),
});
```

## Best Practices

1. **Document all endpoints** - Use `@ApiOperation` and `@ApiResponse`
2. **Document authentication** - Add `@ApiBearerAuth()` where needed
3. **Use examples** - Help developers understand the API
4. **Keep docs in sync** - Update when API changes
5. **Use tags** - Group related endpoints
Group related endpoints
