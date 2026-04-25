# Testing

NestJS provides a comprehensive testing framework with Jest and Supertest. Works with Zod schemas and shared types.

## Installation

```bash
pnpm add -D @nestjs/testing jest @types/jest ts-jest supertest @types/supertest
```

## Unit Testing

### Service Test

```typescript
// apps/api/src/cats/cats.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CatsService } from './cats.service';
import { Cat } from './entities/cat.entity';
import { createCatSchema, CreateCatDto } from '@myapp/shared-types';

describe('CatsService', () => {
  let service: CatsService;
  let mockRepository: any;

  beforeEach(async () => {
    mockRepository = {
      find: jest.fn(),
      findOneBy: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      findAndCount: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatsService,
        {
          provide: getRepositoryToken(Cat),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<CatsService>(CatsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new cat', async () => {
      // Use shared type for test data
      const createCatDto: CreateCatDto = {
        name: 'Whiskers',
        age: 2,
        breed: 'Persian',
        status: 'active',
        tags: [],
      };

      const createdCat = { id: 'uuid-123', ...createCatDto };
      mockRepository.create.mockReturnValue(createdCat);
      mockRepository.save.mockResolvedValue(createdCat);

      const result = await service.create(createCatDto);

      expect(result).toEqual(createdCat);
      expect(mockRepository.create).toHaveBeenCalledWith(createCatDto);
      expect(mockRepository.save).toHaveBeenCalledWith(createdCat);
    });

    it('should validate input with Zod schema', () => {
      const invalidData = { name: '', age: -1 };

      const result = createCatSchema.safeParse(invalidData);

      expect(result.success).toBe(false);
    });
  });

  describe('findAll', () => {
    it('should return paginated cats', async () => {
      const cats = [{ id: '1', name: 'Whiskers' }];
      const total = 1;

      mockRepository.findAndCount.mockResolvedValue([cats, total]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toEqual(cats);
      expect(result.meta.total).toBe(total);
    });
  });

  describe('findOne', () => {
    it('should return a single cat', async () => {
      const cat = { id: '1', name: 'Whiskers' };
      mockRepository.findOneBy.mockResolvedValue(cat);

      const result = await service.findOne('1');

      expect(result).toEqual(cat);
    });

    it('should throw if cat not found', async () => {
      mockRepository.findOneBy.mockResolvedValue(null);

      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
    });
  });
});
```

### Controller Test

```typescript
// apps/api/src/cats/cats.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { CatsController } from './cats.controller';
import { CatsService } from './cats.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { createCatSchema, updateCatSchema } from '@myapp/shared-types';

describe('CatsController', () => {
  let controller: CatsController;
  let service: CatsService;

  beforeEach(async () => {
    const mockService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatsController],
      providers: [
        {
          provide: CatsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<CatsController>(CatsController);
    service = module.get(CatsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new cat', async () => {
      const createCatDto = {
        name: 'Whiskers',
        age: 2,
        breed: 'Persian',
      };

      const createdCat = { id: 'uuid-123', ...createCatDto };
      jest.spyOn(service, 'create').mockResolvedValue(createdCat);

      const result = await controller.create(createCatDto);

      expect(result).toEqual(createdCat);
      expect(service.create).toHaveBeenCalledWith(createCatDto);
    });
  });

  describe('findAll', () => {
    it('should return paginated cats', async () => {
      const result = {
        data: [{ id: '1', name: 'Whiskers' }],
        meta: { total: 1, page: 1, limit: 10 },
      };

      jest.spyOn(service, 'findAll').mockResolvedValue(result);

      expect(await controller.findAll({ page: 1, limit: 10 })).toBe(result);
    });
  });
});
```

### Zod Validation Pipe Test

```typescript
// apps/api/src/common/pipes/zod-validation.pipe.spec.ts
import { ZodValidationPipe } from './zod-validation.pipe';
import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

describe('ZodValidationPipe', () => {
  const schema = z.object({
    name: z.string().min(2),
    age: z.number().int().min(0),
  });

  let pipe: ZodValidationPipe;

  beforeEach(() => {
    pipe = new ZodValidationPipe(schema);
  });

  it('should validate correct data', () => {
    const data = { name: 'Whiskers', age: 2 };

    const result = pipe.transform(data);

    expect(result).toEqual(data);
  });

  it('should throw BadRequestException for invalid data', () => {
    const data = { name: '', age: -1 };

    expect(() => pipe.transform(data)).toThrow(BadRequestException);
  });

  it('should include field errors in exception', () => {
    const data = { name: '', age: -1 };

    try {
      pipe.transform(data);
    } catch (error) {
      expect(error.response.errors).toBeDefined();
      expect(error.response.errors.length).toBeGreaterThan(0);
    }
  });
});
```

## E2E Testing

```typescript
// apps/api/test/cats.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('CatsController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /cats', () => {
    it('should create a new cat', () => {
      return request(app.getHttpServer())
        .post('/cats')
        .send({
          name: 'Whiskers',
          age: 2,
          breed: 'Persian',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.name).toBe('Whiskers');
          expect(res.body.age).toBe(2);
          expect(res.body.id).toBeDefined();
        });
    });

    it('should validate input with Zod', () => {
      return request(app.getHttpServer())
        .post('/cats')
        .send({ name: '', age: -1 })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe('Validation failed');
          expect(res.body.errors).toBeDefined();
        });
    });
  });

  describe('GET /cats', () => {
    it('should return paginated cats', async () => {
      // Create a cat first
      await request(app.getHttpServer())
        .post('/cats')
        .send({ name: 'Whiskers', age: 2 });

      return request(app.getHttpServer())
        .get('/cats?page=1&limit=10')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.meta).toBeDefined();
          expect(res.body.meta.total).toBeGreaterThan(0);
        });
    });

    it('should validate query params', () => {
      return request(app.getHttpServer())
        .get('/cats?page=invalid')
        .expect(400);
    });
  });

  describe('GET /cats/:id', () => {
    it('should return a single cat', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/cats')
        .send({ name: 'Whiskers', age: 2 });

      const catId = createRes.body.id;

      return request(app.getHttpServer())
        .get(`/cats/${catId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe('Whiskers');
        });
    });

    it('should return 404 for non-existent cat', () => {
      return request(app.getHttpServer())
        .get('/cats/550e8400-e29b-41d4-a716-446655440999')
        .expect(404);
    });
  });

  describe('PATCH /cats/:id', () => {
    it('should update a cat', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/cats')
        .send({ name: 'Whiskers', age: 2 });

      const catId = createRes.body.id;

      return request(app.getHttpServer())
        .patch(`/cats/${catId}`)
        .send({ name: 'Updated Name' })
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe('Updated Name');
        });
    });
  });

  describe('DELETE /cats/:id', () => {
    it('should delete a cat', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/cats')
        .send({ name: 'Whiskers', age: 2 });

      const catId = createRes.body.id;

      return request(app.getHttpServer())
        .delete(`/cats/${catId}`)
        .expect(204);
    });
  });
});
```

## Testing Utilities

### Auto Mocking

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('CatsService', () => {
  let service: CatsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CatsService,
        {
          provide: getRepositoryToken(Cat),
          useValue: {
            find: jest.fn(),
            findOneBy: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CatsService>(CatsService);
  });
});
```

### Override Providers

```typescript
const module = await Test.createTestingModule({
  imports: [AppModule],
})
  .overrideProvider(CatsService)
  .useValue(mockCatsService)
  .overrideGuard(JwtAuthGuard)
  .useValue({ canActivate: () => true })
  .overridePipe(ZodValidationPipe)
  .useValue({ transform: (value) => value })
  .compile();
```

## Testing with Database

```typescript
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';

describe('CatsService (Integration)', () => {
  let service: CatsService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [Cat],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([Cat]),
      ],
      providers: [CatsService],
    }).compile();

    service = module.get<CatsService>(CatsService);
  });

  afterAll(async () => {
    await module.close();
  });

  it('should create and retrieve a cat', async () => {
    const createCatDto: CreateCatDto = {
      name: 'Whiskers',
      age: 2,
      status: 'active',
      tags: [],
    };

    const cat = await service.create(createCatDto);
    expect(cat.id).toBeDefined();

    const found = await service.findOne(cat.id);
    expect(found.name).toBe('Whiskers');
  });
});
```

## Jest Configuration

```json
// apps/api/package.json
{
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "collectCoverageFrom": [
      "**/*.(t|j)s"
    ],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node",
    "moduleNameMapper": {
      "^@myapp/shared-types$": "<rootDir>/../../packages/shared-types/src"
    }
  }
}
```

## Test Scripts

```json
// apps/api/package.json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
    "test:e2e": "jest --config ./test/jest-e2e.json"
  }
}
```

## Best Practices

1. **Use shared types for test data** - Import from `@myapp/shared-types`
2. **Test Zod validation** - Ensure schemas work correctly
3. **Mock external dependencies** - Database, external APIs
4. **Test edge cases** - Empty arrays, null values, errors
5. **Use factories for test data** - Consistent data creation
6. **Clean up after tests** - Close connections, clean database
7. **Maintain test isolation** - Tests shouldn't depend on each other
- Tests shouldn't depend on each other
