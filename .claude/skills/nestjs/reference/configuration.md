# Configuration

NestJS provides a flexible way to manage configuration using environment variables and configuration files.

## Installation

```bash
npm install @nestjs/config
```

## Basic Setup

### Configuration File

```typescript
// config/configuration.ts
export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT, 10) || 5432,
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    name: process.env.DATABASE_NAME,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },
});
```

### Module Registration

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,                    // Available everywhere
      load: [configuration],              // Load config files
      envFilePath: [                      // Environment files
        '.env.development.local',
        '.env.development',
        '.env',
      ],
      cache: true,                        // Cache environment variables
      expandVariables: true,              // Expand ${VAR} syntax
      validationSchema: Joi.object({     // Validation schema
        PORT: Joi.number().default(3000),
        DATABASE_HOST: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
      }),
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
  ],
})
export class AppModule {}
```

## Using ConfigService

### Injection

```typescript
@Injectable()
export class AppService {
  constructor(private configService: ConfigService) {}
}
```

### Get Values

```typescript
@Injectable()
export class AppService {
  constructor(private configService: ConfigService) {}

  getPort(): number {
    return this.configService.get<number>('port');
  }

  getDatabaseHost(): string {
    return this.configService.get<string>('database.host');
  }

  getWithDefault(): string {
    return this.configService.get<string>('UNKNOWN_KEY', 'default_value');
  }
}
```

### Type-safe Access

```typescript
// config/configuration.ts
export interface Config {
  port: number;
  database: {
    host: string;
    port: number;
  };
}

// Usage
@Injectable()
export class AppService {
  constructor(private configService: ConfigService<Config>) {}

  getPort(): number {
    return this.configService.get('port', { infer: true });
  }
}
```

## Feature-specific Config

### Database Config

```typescript
// config/database.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT, 10) || 5432,
  username: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  synchronize: process.env.NODE_ENV !== 'production',
}));
```

### JWT Config

```typescript
// config/jwt.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
}));
```

### Using Feature Config

```typescript
// app.module.ts
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [databaseConfig, jwtConfig],
    }),
  ],
})
export class AppModule {}

// Usage
@Injectable()
export class DatabaseService {
  constructor(
    @Inject(databaseConfig.KEY)
    private dbConfig: ConfigType<typeof databaseConfig>,
  ) {}

  getHost(): string {
    return this.dbConfig.host;
  }
}
```

## Async Configuration

### TypeORM with Config

```typescript
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
        synchronize: configService.get('database.synchronize'),
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
```

### JWT Module with Config

```typescript
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('jwt.secret'),
        signOptions: {
          expiresIn: configService.get('jwt.expiresIn'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AuthModule {}
```

## Custom Config Service

```typescript
// config/config.service.ts
@Injectable()
export class ApiConfigService {
  constructor(private configService: ConfigService) {}

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isTest(): boolean {
    return this.nodeEnv === 'test';
  }

  private get nodeEnv(): string {
    return this.configService.get('NODE_ENV', 'development');
  }

  get port(): number {
    return this.configService.get('PORT', 3000);
  }

  get databaseConfig() {
    return {
      host: this.configService.get('DATABASE_HOST'),
      port: this.configService.get('DATABASE_PORT'),
      // ...
    };
  }
}

// Registration
@Module({
  providers: [ApiConfigService],
  exports: [ApiConfigService],
})
export class ConfigModule {}
```

## Environment Validation

```typescript
import * as Joi from 'joi';

const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  DATABASE_HOST: Joi.string().required(),
  DATABASE_PORT: Joi.number().default(5432),
  JWT_SECRET: Joi.string().required().min(32),
});

@Module({
  imports: [
    ConfigModule.forRoot({
      validationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
  ],
})
export class AppModule {}
```

## Sample .env Files

### .env (default)

```env
NODE_ENV=development
PORT=3000

DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=password
DATABASE_NAME=myapp

JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=1d
```

### .env.development

```env
DATABASE_HOST=localhost
DATABASE_SYNCHRONIZE=true
DEBUG=true
```

### .env.production

```env
NODE_ENV=production
DATABASE_SYNCHRONIZE=false
DEBUG=false
```

## Best Practices

1. **Never commit .env files** to version control
2. **Use .env.example** to document required variables
3. **Validate configuration** at startup
4. **Use default values** for optional variables
5. **Group related config** using `registerAs`
6. **Use TypeScript interfaces** for type safety
7. **Cache configuration** in production
