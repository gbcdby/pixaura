# Middleware

Middleware functions run before route handlers and can perform tasks like logging, authentication, etc.

## Class-based Middleware

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  }
}
```

## Functional Middleware

```typescript
export function logger(req: Request, res: Response, next: NextFunction) {
  console.log(`Request... ${req.method} ${req.url}`);
  next();
}
```

## Apply Middleware

```typescript
import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';

@Module({})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply to all routes
    consumer.apply(LoggerMiddleware).forRoutes('*');

    // Apply to specific controller
    consumer.apply(LoggerMiddleware).forRoutes(CatsController);

    // Apply to specific routes
    consumer.apply(LoggerMiddleware).forRoutes(
      { path: 'cats', method: RequestMethod.GET },
      { path: 'cats', method: RequestMethod.POST },
    );

    // Exclude routes
    consumer
      .apply(LoggerMiddleware)
      .exclude(
        { path: 'cats', method: RequestMethod.GET },
        { path: 'cats', method: RequestMethod.POST },
        'cats/(.*)',  // Wildcard
      )
      .forRoutes(CatsController);

    // Multiple middleware
    consumer.apply(cors(), helmet(), logger).forRoutes('*');

    // Chaining
    consumer
      .apply(LoggerMiddleware)
      .forRoutes(CatsController)
      .apply(AuthMiddleware)
      .forRoutes(DogsController);
  }
}
```

## Middleware with Dependencies

```typescript
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    try {
      const decoded = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get('JWT_SECRET'),
      });
      req.user = decoded;
      next();
    } catch {
      return res.status(401).json({ message: 'Invalid token' });
    }
  }
}
```

## Common Middleware Examples

### CORS

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: ['http://localhost:3000', 'https://example.com'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  await app.listen(3000);
}
```

### Helmet (Security)

```typescript
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());

  // With options
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));

  await app.listen(3000);
}
```

### Rate Limiting

```typescript
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60,  // Time window in seconds
      limit: 10,  // Max requests per window
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
```

### Compression

```typescript
import compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(compression());

  await app.listen(3000);
}
```

### Request ID

```typescript
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    req.id = req.headers['x-request-id'] || uuidv4();
    res.setHeader('x-request-id', req.id);
    next();
  }
}
```

### Body Parser

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Default body parser
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

  await app.listen(3000);
}
```

## Middleware Execution Order

1. Global middleware (app.use)
2. Module middleware (configure method)
3. Global guards
4. Controller guards
5. Route guards
6. Global interceptors (pre)
7. Controller interceptors (pre)
8. Route interceptors (pre)
9. Global pipes
10. Route pipes
11. Controller (method handler)
12. Route interceptors (post)
13. Controller interceptors (post)
14. Global interceptors (post)
15. Exception filters
