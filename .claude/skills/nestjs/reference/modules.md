# Modules

Modules organize the application structure. Every NestJS application has at least one root module.

## Basic Module

```typescript
import { Module } from '@nestjs/common';
import { CatsController } from './cats.controller';
import { CatsService } from './cats.service';

@Module({
  imports: [],        // Other modules to import
  controllers: [CatsController],  // Controllers in this module
  providers: [CatsService],       // Providers to instantiate
  exports: [CatsService]          // Providers available to other modules
})
export class CatsModule {}
```

## Module Properties

| Property | Description |
|----------|-------------|
| `imports` | List of imported modules whose exported providers are needed |
| `controllers` | Controllers defined in this module |
| `providers` | Providers that will be instantiated by Nest |
| `exports` | Subset of providers available to other modules |

## Feature Module

```typescript
// cats.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([Cat])],
  controllers: [CatsController],
  providers: [CatsService],
})
export class CatsModule {}

// app.module.ts
@Module({
  imports: [CatsModule, DogsModule, UsersModule],
})
export class AppModule {}
```

## Shared Module

```typescript
@Module({
  providers: [CommonService, DateHelper, StringHelper],
  exports: [CommonService, DateHelper, StringHelper],
})
export class CommonModule {}

// Usage in other modules
@Module({
  imports: [CommonModule],  // Now CommonService is available
  providers: [CatsService],
})
export class CatsModule {}
```

## Global Module

```typescript
@Global()  // Available everywhere without importing
@Module({
  providers: [ConfigService, LoggerService],
  exports: [ConfigService, LoggerService],
})
export class CoreModule {}
```

## Dynamic Module

```typescript
@Module({})
export class ConfigModule {
  static forRoot(options: ConfigOptions): DynamicModule {
    return {
      module: ConfigModule,
      providers: [
        {
          provide: 'CONFIG_OPTIONS',
          useValue: options,
        },
        ConfigService,
      ],
      exports: [ConfigService],
    };
  }

  static forFeature(feature: string): DynamicModule {
    return {
      module: ConfigModule,
      providers: [
        {
          provide: 'FEATURE_CONFIG',
          useValue: feature,
        },
      ],
    };
  }
}

// Usage
@Module({
  imports: [
    ConfigModule.forRoot({ folder: './config' }),
    ConfigModule.forFeature('cats'),
  ],
})
export class AppModule {}
```

## Module Re-exporting

```typescript
@Module({
  imports: [CommonModule, UtilsModule],
  exports: [CommonModule, UtilsModule],  // Re-export
})
export class SharedModule {}

// Now importing SharedModule gives access to both
@Module({
  imports: [SharedModule],  // CommonModule + UtilsModule available
})
export class FeatureModule {}
```

## Forward Reference

For circular dependencies between modules:

```typescript
@Module({
  imports: [forwardRef(() => DogsModule)],
  providers: [CatsService],
})
export class CatsModule {}

@Module({
  imports: [forwardRef(() => CatsModule)],
  providers: [DogsService],
})
export class DogsModule {}
```

## Async Module Configuration

```typescript
@Module({})
export class DatabaseModule {
  static forRootAsync(options: DatabaseAsyncOptions): DynamicModule {
    return {
      module: DatabaseModule,
      imports: options.imports || [],
      providers: [
        {
          provide: 'DATABASE_CONFIG',
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
      ],
      exports: ['DATABASE_CONFIG'],
    };
  }
}

// Usage
@Module({
  imports: [
    DatabaseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

## Lazy Loading Modules

```typescript
// app.module.ts
@Module({
  imports: [
    RouterModule.register([
      {
        path: 'cats',
        module: CatsModule,
      },
    ]),
  ],
})
export class AppModule {}

// Lazy loaded
const CatsModule = () => import('./cats/cats.module').then(m => m.CatsModule);
```

## Module Organization Best Practices

```
src/
├── modules/
│   ├── cats/
│   │   ├── cats.controller.ts
│   │   ├── cats.service.ts
│   │   ├── cats.module.ts
│   │   ├── dto/
│   │   └── entities/
│   ├── dogs/
│   └── users/
├── common/
│   ├── common.module.ts
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   └── pipes/
├── config/
│   └── config.module.ts
└── app.module.ts
```
