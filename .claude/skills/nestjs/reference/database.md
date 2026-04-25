# Database Integration

NestJS supports multiple database solutions. This document shows integration with TypeORM using Zod schemas from shared types.

## TypeORM

### Installation

```bash
pnpm add @nestjs/typeorm typeorm pg
```

### Configuration

```typescript
// apps/api/src/app.module.ts
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.username'),
        password: configService.get('database.password'),
        database: configService.get('database.name'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get('nodeEnv') !== 'production',
        logging: configService.get('nodeEnv') === 'development',
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

### Entity

```typescript
// apps/api/src/cats/entities/cat.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class Cat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'int' })
  age: number;

  @Column({ default: 'unknown' })
  breed: string;

  @Column({
    type: 'enum',
    enum: ['active', 'inactive', 'pending'],
    default: 'active',
  })
  status: string;

  @Column('simple-array', { default: '' })
  tags: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### Service with Shared Types

```typescript
// apps/api/src/cats/cats.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cat } from './entities/cat.entity';
import { CreateCatDto, UpdateCatDto, PaginationQuery } from '@myapp/shared-types';

@Injectable()
export class CatsService {
  constructor(
    @InjectRepository(Cat)
    private catsRepository: Repository<Cat>,
  ) {}

  async create(createCatDto: CreateCatDto): Promise<Cat> {
    const cat = this.catsRepository.create(createCatDto);
    return this.catsRepository.save(cat);
  }

  async findAll(query: PaginationQuery): Promise<{ data: Cat[]; total: number }> {
    const { page, limit } = query;
    const [data, total] = await this.catsRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  async findOne(id: string): Promise<Cat> {
    const cat = await this.catsRepository.findOne({ where: { id } });
    if (!cat) {
      throw new NotFoundException(`Cat with ID ${id} not found`);
    }
    return cat;
  }

  async update(id: string, updateCatDto: UpdateCatDto): Promise<Cat> {
    const cat = await this.findOne(id);
    Object.assign(cat, updateCatDto);
    return this.catsRepository.save(cat);
  }

  async remove(id: string): Promise<void> {
    const result = await this.catsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Cat with ID ${id} not found`);
    }
  }
}
```

### Module

```typescript
// apps/api/src/cats/cats.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatsController } from './cats.controller';
import { CatsService } from './cats.service';
import { Cat } from './entities/cat.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Cat])],
  controllers: [CatsController],
  providers: [CatsService],
  exports: [CatsService],
})
export class CatsModule {}
```

## Prisma

### Installation

```bash
pnpm add prisma @prisma/client
pnpm exec prisma init
```

### Schema

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Cat {
  id        String   @id @default(uuid())
  name      String
  age       Int
  breed     String   @default("unknown")
  status    String   @default("active")
  tags      String[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Prisma Service

```typescript
// apps/api/src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

### Service with Shared Types

```typescript
// apps/api/src/cats/cats.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCatDto, UpdateCatDto, PaginationQuery } from '@myapp/shared-types';

@Injectable()
export class CatsService {
  constructor(private prisma: PrismaService) {}

  async create(createCatDto: CreateCatDto) {
    return this.prisma.cat.create({
      data: createCatDto,
    });
  }

  async findAll(query: PaginationQuery) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.cat.findMany({
        skip,
        take: limit,
      }),
      this.prisma.cat.count(),
    ]);

    return { data, total };
  }

  async findOne(id: string) {
    const cat = await this.prisma.cat.findUnique({ where: { id } });
    if (!cat) {
      throw new NotFoundException(`Cat with ID ${id} not found`);
    }
    return cat;
  }

  async update(id: string, updateCatDto: UpdateCatDto) {
    await this.findOne(id); // Check exists
    return this.prisma.cat.update({
      where: { id },
      data: updateCatDto,
    });
  }

  async remove(id: string) {
    await this.findOne(id); // Check exists
    return this.prisma.cat.delete({ where: { id } });
  }
}
```

## Mongoose (MongoDB)

### Installation

```bash
pnpm add @nestjs/mongoose mongoose
```

### Schema

```typescript
// apps/api/src/cats/schemas/cat.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CatDocument = Cat & Document;

@Schema({ timestamps: true })
export class Cat {
  @Prop({ required: true })
  name: string;

  @Prop()
  age: number;

  @Prop({ default: 'unknown' })
  breed: string;

  @Prop({ default: 'active' })
  status: string;

  @Prop([String])
  tags: string[];
}

export const CatSchema = SchemaFactory.createForClass(Cat);
```

### Service with Shared Types

```typescript
// apps/api/src/cats/cats.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cat, CatDocument } from './schemas/cat.schema';
import { CreateCatDto, UpdateCatDto, PaginationQuery } from '@myapp/shared-types';

@Injectable()
export class CatsService {
  constructor(@InjectModel(Cat.name) private catModel: Model<CatDocument>) {}

  async create(createCatDto: CreateCatDto): Promise<Cat> {
    const createdCat = new this.catModel(createCatDto);
    return createdCat.save();
  }

  async findAll(query: PaginationQuery): Promise<{ data: Cat[]; total: number }> {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.catModel.find().skip(skip).limit(limit).exec(),
      this.catModel.countDocuments().exec(),
    ]);

    return { data, total };
  }

  async findOne(id: string): Promise<Cat> {
    const cat = await this.catModel.findById(id).exec();
    if (!cat) {
      throw new NotFoundException(`Cat with ID ${id} not found`);
    }
    return cat;
  }

  async update(id: string, updateCatDto: UpdateCatDto): Promise<Cat> {
    const cat = await this.catModel
      .findByIdAndUpdate(id, updateCatDto, { new: true })
      .exec();
    if (!cat) {
      throw new NotFoundException(`Cat with ID ${id} not found`);
    }
    return cat;
  }

  async remove(id: string): Promise<void> {
    const result = await this.catModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Cat with ID ${id} not found`);
    }
  }
}
```

## Pagination with Shared Types

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

export const paginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
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
```

```typescript
// apps/api/src/cats/cats.service.ts
import { PaginationQuery } from '@myapp/shared-types';

async findAll(query: PaginationQuery) {
  const { page, limit } = query;
  const skip = (page - 1) * limit;

  const [data, total] = await this.catsRepository.findAndCount({
    skip,
    take: limit,
  });

  const totalPages = Math.ceil(total / limit);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}
```

## Transactions

```typescript
// apps/api/src/cats/cats.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cat } from './entities/cat.entity';
import { Owner } from './entities/owner.entity';
import { CreateCatDto } from '@myapp/shared-types';

@Injectable()
export class CatsService {
  constructor(
    @InjectRepository(Cat)
    private catsRepository: Repository<Cat>,
    @InjectRepository(Owner)
    private ownersRepository: Repository<Owner>,
    private dataSource: DataSource,
  ) {}

  async createWithOwner(catDto: CreateCatDto, ownerName: string) {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create owner
      const owner = await queryRunner.manager.save(Owner, { name: ownerName });

      // Create cat with owner
      const cat = await queryRunner.manager.save(Cat, {
        ...catDto,
        ownerId: owner.id,
      });

      await queryRunner.commitTransaction();
      return { cat, owner };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
```

## Best Practices

1. **Use shared types for all DTOs** - Import from `@myapp/shared-types`
2. **Map database entities separately** - Don't use DTOs as entities
3. **Use transactions for multi-table operations**
4. **Handle not found errors** - Throw `NotFoundException`
5. **Use pagination for list endpoints** - Don't return all records
6. **Use async/await** - All database operations are async
t return all records
6. **Use async/await** - All database operations are async
