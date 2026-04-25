# Dependency Injection

NestJS uses a powerful dependency injection (DI) container based on TypeScript decorators.

## Standard Providers

### Injectable Service

```typescript
@Injectable()
export class CatsService {
  private readonly cats: Cat[] = [];

  findAll(): Cat[] {
    return this.cats;
  }
}
```

### Registration

```typescript
@Module({
  providers: [CatsService],
  controllers: [CatsController],
})
export class CatsModule {}
```

### Injection

```typescript
@Controller('cats')
export class CatsController {
  constructor(private catsService: CatsService) {}
}
```

## Custom Providers

### Value Providers (useValue)

```typescript
@Module({
  providers: [
    {
      provide: 'CONNECTION',
      useValue: connection,
    },
    {
      provide: 'CONFIG',
      useValue: {
        apiUrl: 'https://api.example.com',
        timeout: 5000,
      },
    },
  ],
})
export class AppModule {}

// Injection
constructor(@Inject('CONNECTION') private connection: Connection) {}
```

### Class Providers (useClass)

```typescript
@Module({
  providers: [
    {
      provide: CatsService,
      useClass: CatsService,
    },
    // Conditional class
    {
      provide: ConfigService,
      useClass:
        process.env.NODE_ENV === 'development'
          ? DevelopmentConfigService
          : ProductionConfigService,
    },
  ],
})
export class AppModule {}
```

### Factory Providers (useFactory)

```typescript
@Module({
  providers: [
    {
      provide: 'DATABASE_CONNECTION',
      useFactory: (configService: ConfigService) => {
        return createConnection({
          host: configService.get('DB_HOST'),
          port: configService.get('DB_PORT'),
        });
      },
      inject: [ConfigService],  // Dependencies
    },
    // Async factory
    {
      provide: 'ASYNC_CONNECTION',
      useFactory: async (configService: ConfigService) => {
        const connection = await createConnection(configService.get('db'));
        return connection;
      },
      inject: [ConfigService],
    },
  ],
})
export class AppModule {}
```

### Alias Providers (useExisting)

```typescript
@Module({
  providers: [
    CatsService,
    {
      provide: 'ALIASED_CATS_SERVICE',
      useExisting: CatsService,  // Same instance
    },
  ],
})
export class AppModule {}
```

## Injection Scopes

### Default (Singleton)

```typescript
@Injectable()
export class CatsService {}
```

### Request Scope

```typescript
@Injectable({ scope: Scope.REQUEST })
export class CatsService {
  private requestData: any;

  setRequestData(data: any) {
    this.requestData = data;
  }
}
```

### Transient Scope

```typescript
@Injectable({ scope: Scope.TRANSIENT })
export class CatsService {}
```

### Controller Scope

```typescript
@Controller({
  path: 'cats',
  scope: Scope.REQUEST,
})
export class CatsController {}
```

## Injection Patterns

### Constructor Injection

```typescript
@Controller('cats')
export class CatsController {
  constructor(
    private catsService: CatsService,
    private configService: ConfigService,
    @Inject('CONNECTION') private connection: Connection,
  ) {}
}
```

### Property Injection

```typescript
@Controller('cats')
export class CatsController {
  @Inject(CatsService)
  private catsService: CatsService;

  @Inject('CONNECTION')
  private connection: Connection;
}
```

### Optional Injection

```typescript
@Injectable()
export class CatsService {
  constructor(
    @Optional() @Inject('LOGGER') private logger?: Logger,
  ) {}
}
```

## Provider Tokens

### String Tokens

```typescript
{
  provide: 'DATABASE_CONNECTION',
  useFactory: () => createConnection(),
}

// Inject
constructor(@Inject('DATABASE_CONNECTION') private db: Connection) {}
```

### Symbol Tokens

```typescript
export const DATABASE_CONNECTION = Symbol('DATABASE_CONNECTION');

{
  provide: DATABASE_CONNECTION,
  useFactory: () => createConnection(),
}

// Inject
constructor(
  @Inject(DATABASE_CONNECTION) private db: Connection,
) {}
```

### Class Tokens

```typescript
{
  provide: CatsService,
  useClass: CatsService,
}

// Inject (constructor injection)
constructor(private catsService: CatsService) {}
```

## Async Providers

```typescript
@Module({
  providers: [
    {
      provide: 'DATABASE_CONNECTION',
      useFactory: async (): Promise<Connection> => {
        const connection = await createConnection(options);
        return connection;
      },
    },
  ],
})
export class DatabaseModule {}

// Usage
@Injectable()
export class CatsService {
  constructor(@Inject('DATABASE_CONNECTION') private connection: Connection) {}
}
```

## Circular Dependency

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

// cats.module.ts
@Module({
  imports: [forwardRef(() => DogsModule)],
  providers: [CatsService],
  exports: [CatsService],
})
export class CatsModule {}

// dogs.module.ts
@Module({
  imports: [forwardRef(() => CatsModule)],
  providers: [DogsService],
  exports: [DogsService],
})
export class DogsModule {}
```

## Module Reference

```typescript
@Injectable()
export class CatsService implements OnModuleInit {
  private dogsService: DogsService;

  constructor(private moduleRef: ModuleRef) {}

  onModuleInit() {
    this.dogsService = this.moduleRef.get(DogsService);
  }

  // Get by token
  getConnection() {
    return this.moduleRef.get('CONNECTION');
  }

  // Resolve transient provider
  async getTransientService() {
    return this.moduleRef.resolve(TransientService);
  }
}
```

## Provider Visibility

### Exported Providers

```typescript
@Module({
  providers: [CatsService, InternalService],
  exports: [CatsService],  // Only CatsService is public
})
export class CatsModule {}
```

### Re-exporting

```typescript
@Module({
  imports: [CommonModule, UtilsModule],
  exports: [CommonModule, UtilsModule],
})
export class SharedModule {}
```

## Best Practices

1. **Use constructor injection** for required dependencies
2. **Use `@Optional()`** for optional dependencies
3. **Prefer interfaces** over concrete classes
4. **Use tokens** for configuration values
5. **Avoid circular dependencies** when possible
6. **Use singleton scope** by default
7. **Export only what's needed**
