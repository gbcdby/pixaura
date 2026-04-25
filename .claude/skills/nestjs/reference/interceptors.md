# Interceptors

Interceptors transform responses or add side effects like logging, caching, timeouts, and exception mapping.

## Basic Interceptor

```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    console.log('Before...');

    const now = Date.now();
    return next
      .handle()
      .pipe(tap(() => console.log(`After... ${Date.now() - now}ms`)));
  }
}
```

## Transform Response

```typescript
export interface Response<T> {
  data: T;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    return next.handle().pipe(map((data) => ({ data })));
  }
}

// Response: { "data": [...] }
```

## Exclude Null Values

```typescript
@Injectable()
export class ExcludeNullInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next
      .handle()
      .pipe(map((value) => (value === null ? '' : value)));
  }
}
```

## Timeout Interceptor

```typescript
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout(5000),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(() => new RequestTimeoutException());
        }
        return throwError(() => err);
      }),
    );
  }
}
```

## Cache Interceptor

```typescript
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const cacheKey = `${request.url}`;

    const cachedData = await this.cacheManager.get(cacheKey);
    if (cachedData) {
      return of(cachedData);
    }

    return next.handle().pipe(
      tap(async (data) => {
        await this.cacheManager.set(cacheKey, data, 60000); // 1 minute
      }),
    );
  }
}
```

## Error Handling Interceptor

```typescript
@Injectable()
export class ErrorsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((err) => {
        // Log error
        console.error('Error:', err);

        // Transform error response
        return throwError(() => new BadGatewayException());
      }),
    );
  }
}
```

## Serialize Interceptor

```typescript
@Injectable()
export class SerializeInterceptor implements NestInterceptor {
  constructor(private dto: any) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        return plainToInstance(this.dto, data, {
          excludeExtraneousValues: true,
        });
      }),
    );
  }
}

// Usage
@Controller('cats')
export class CatsController {
  @Get()
  @UseInterceptors(new SerializeInterceptor(CatResponseDto))
  findAll() {
    return this.catsService.findAll();
  }
}
```

## Logging Interceptor with Logger

```typescript
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.url;
    const now = Date.now();

    this.logger.log(`Incoming Request: ${method} ${url}`);

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        const statusCode = response.statusCode;
        const duration = Date.now() - now;

        this.logger.log(
          `Response: ${method} ${url} ${statusCode} - ${duration}ms`,
        );
      }),
    );
  }
}
```

## Apply Interceptors

```typescript
// Method-scoped
@Get()
@UseInterceptors(LoggingInterceptor)
findAll() {}

// Controller-scoped
@UseInterceptors(LoggingInterceptor)
@Controller('cats')
export class CatsController {}

// Global (main.ts)
app.useGlobalInterceptors(new LoggingInterceptor());

// Global with DI
@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
```

## Multiple Interceptors

```typescript
@Controller('cats')
export class CatsController {
  @Get()
  @UseInterceptors(LoggingInterceptor, TransformInterceptor, CacheInterceptor)
  findAll() {}
}

// Execution order: Logging -> Transform -> Cache
```

## WebSocket Interceptor

```typescript
@Injectable()
export class WebSocketLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const client = context.switchToWs().getClient();
    const pattern = context.switchToWs().getPattern();

    console.log(`WebSocket Event: ${pattern}`);

    return next.handle().pipe(
      tap((data) => {
        console.log(`WebSocket Response:`, data);
      }),
    );
  }
}
```

## RPC Interceptor

```typescript
@Injectable()
export class RpcLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const data = context.switchToRpc().getData();
    const pattern = context.switchToRpc().getPattern();

    console.log(`RPC Pattern: ${pattern}`, data);

    return next.handle();
  }
}
```

## RxJS Operators for Interceptors

```typescript
import {
  map,        // Transform data
  tap,        // Side effects
  catchError, // Error handling
  timeout,    // Set timeout
  retry,      // Retry on failure
  debounceTime, // Debounce
  throttleTime, // Throttle
  distinctUntilChanged, // Filter duplicates
} from 'rxjs/operators';

@Injectable()
export class AdvancedInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      debounceTime(300),
      distinctUntilChanged(),
      retry(3),
      timeout(5000),
      map((data) => this.transform(data)),
      tap((data) => this.log(data)),
      catchError((err) => this.handleError(err)),
    );
  }
}
```
