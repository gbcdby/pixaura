# Providers

Providers are the core of NestJS. Services, repositories, factories, and helpers are all providers.

## Basic Service

```typescript
import { Injectable } from '@nestjs/common';

export interface Cat {
  name: string;
  age: number;
  breed: string;
}

@Injectable()
export class CatsService {
  private readonly cats: Cat[] = [];

  create(cat: Cat) {
    this.cats.push(cat);
  }

  findAll(): Cat[] {
    return this.cats;
  }

  findOne(id: string): Cat {
    return this.cats.find(cat => cat.id === id);
  }

  update(id: string, cat: Partial<Cat>): Cat {
    const index = this.cats.findIndex(c => c.id === id);
    if (index !== -1) {
      this.cats[index] = { ...this.cats[index], ...cat };
      return this.cats[index];
    }
    return null;
  }

  remove(id: string): boolean {
    const index = this.cats.findIndex(c => c.id === id);
    if (index !== -1) {
      this.cats.splice(index, 1);
      return true;
    }
    return false;
  }
}
```

## Dependency Injection

### Constructor Injection (Recommended)

```typescript
@Controller('cats')
export class CatsController {
  constructor(private catsService: CatsService) {}

  @Get()
  findAll() {
    return this.catsService.findAll();
  }
}
```

### Property Injection

```typescript
@Controller('cats')
export class CatsController {
  @Inject(CatsService)
  private catsService: CatsService;
}
```

### Optional Injection

```typescript
@Injectable()
export class HttpService<T> {
  constructor(
    @Optional() @Inject('HTTP_OPTIONS') private httpClient: T,
  ) {}
}
```

## Provider Registration

```typescript
@Module({
  providers: [CatsService],
  controllers: [CatsController],
})
export class CatsModule {}
```

## Circular Dependency

When two services depend on each other:

```typescript
// cats.service.ts
@Injectable()
export class CatsService {
  constructor(
    @Inject(forwardRef(() => DogsService))
    private dogsService: DogsService,
  ) {}
}

// dogs.service.ts
@Injectable()
export class DogsService {
  constructor(
    @Inject(forwardRef(() => CatsService))
    private catsService: CatsService,
  ) {}
}

// Module registration
@Module({
  imports: [forwardRef(() => DogsModule)],
  providers: [CatsService],
  exports: [CatsService],
})
export class CatsModule {}
```

## Service with Config

```typescript
@Injectable()
export class CatsService {
  constructor(
    private configService: ConfigService,
    @InjectRepository(Cat)
    private catsRepository: Repository<Cat>,
  ) {}

  async findAll() {
    const limit = this.configService.get<number>('QUERY_LIMIT');
    return this.catsRepository.find({ take: limit });
  }
}
```

## Service with External API

```typescript
@Injectable()
export class CatsApiService {
  constructor(private httpService: HttpService) {}

  async fetchExternalCats(): Promise<Cat[]> {
    const { data } = await this.httpService.axiosRef.get<Cat[]>(
      'https://api.cats.com/cats',
    );
    return data;
  }
}
```

## Scoped Providers

```typescript
// Singleton (default)
@Injectable()
export class CatsService {}

// Request-scoped
@Injectable({ scope: Scope.REQUEST })
export class CatsService {
  private requestData: any;

  setRequestData(data: any) {
    this.requestData = data;
  }
}

// Transient (new instance per injection)
@Injectable({ scope: Scope.TRANSIENT })
export class CatsService {}
```

## Provider with Lifecycle Hooks

```typescript
@Injectable()
export class CatsService implements OnModuleInit, OnApplicationBootstrap {
  onModuleInit() {
    console.log('Module initialized');
  }

  onApplicationBootstrap() {
    console.log('Application bootstrapped');
  }
}
```

## Best Practices

1. **Keep services stateless** when possible
2. **Use constructor injection** for dependencies
3. **Single responsibility** - one service per domain
4. **Return typed values** for better type safety
5. **Handle errors** with appropriate exceptions
6. **Use async/await** for asynchronous operations
