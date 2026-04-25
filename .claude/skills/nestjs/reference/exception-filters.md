# Exception Filters

Exception filters handle errors thrown by the application and format error responses.

## Basic Exception Filter

```typescript
import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const message = exception.getResponse();

    response
      .status(status)
      .json({
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        message,
      });
  }
}
```

## Catch All Exceptions

```typescript
import { Catch, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}
```

## Custom Exceptions

```typescript
// Custom exception class
export class CatNotFoundException extends NotFoundException {
  constructor(catId: string) {
    super(`Cat with ID ${catId} not found`);
  }
}

export class CatAlreadyExistsException extends ConflictException {
  constructor(name: string) {
    super(`Cat with name ${name} already exists`);
  }
}

export class InvalidCatDataException extends BadRequestException {
  constructor(message: string) {
    super(`Invalid cat data: ${message}`);
  }
}

// Usage in service
@Injectable()
export class CatsService {
  async findOne(id: string): Promise<Cat> {
    const cat = await this.catsRepository.findOne({ where: { id } });
    if (!cat) {
      throw new CatNotFoundException(id);
    }
    return cat;
  }
}
```

## Built-in HTTP Exceptions

```typescript
import {
  BadRequestException,          // 400
  UnauthorizedException,        // 401
  ForbiddenException,           // 403
  NotFoundException,            // 404
  MethodNotAllowedException,    // 405
  NotAcceptableException,       // 406
  RequestTimeoutException,      // 408
  ConflictException,            // 409
  GoneException,                // 410
  PayloadTooLargeException,     // 413
  UnsupportedMediaTypeException, // 415
  UnprocessableEntityException, // 422
  InternalServerErrorException, // 500
  NotImplementedException,      // 501
  BadGatewayException,          // 502
  ServiceUnavailableException,  // 503
  GatewayTimeoutException,      // 504
} from '@nestjs/common';

// Usage
throw new NotFoundException('Resource not found');
throw new BadRequestException('Invalid input', 'Validation failed');
throw new UnauthorizedException('Invalid credentials');
```

## Apply Filters

```typescript
// Controller-scoped
@UseFilters(HttpExceptionFilter)
@Controller('cats')
export class CatsController {}

// Method-scoped
@Get()
@UseFilters(HttpExceptionFilter)
findAll() {}

// Global-scoped (main.ts)
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(3000);
}

// Global with DI
@Module({
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
```

## Exception Filter with Logger

```typescript
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;

    const ctx = host.switchToHttp();

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const responseBody = {
      statusCode: httpStatus,
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(ctx.getRequest()),
    };

    this.logger.error(
      `HTTP ${httpStatus} Error: ${exception instanceof Error ? exception.message : 'Unknown error'}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}
```

## Validation Exception Filter

```typescript
@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse() as any;

    // Format validation errors
    const validationErrors = exceptionResponse.message;
    const formattedErrors = Array.isArray(validationErrors)
      ? validationErrors.map((error) => ({
          field: error.property,
          errors: Object.values(error.constraints || {}),
        }))
      : [{ message: validationErrors }];

    response.status(status).json({
      statusCode: status,
      message: 'Validation failed',
      errors: formattedErrors,
      timestamp: new Date().toISOString(),
    });
  }
}
```

## WebSocket Exception Filter

```typescript
@Catch()
export class WsExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToWs();
    const client = ctx.getClient();

    const error =
      exception instanceof WsException
        ? exception.getError()
        : { message: 'Internal server error' };

    client.emit('error', {
      event: ctx.getPattern(),
      error,
    });
  }
}
```

## RPC Exception Filter

```typescript
@Catch()
export class RpcExceptionFilter implements ExceptionFilter {
  catch(exception: RpcException, host: ArgumentsHost) {
    return throwError(() => exception.getError());
  }
}
```
