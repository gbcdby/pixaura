import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  StreamableFile,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { FastifyReply } from "fastify";

export interface Response<T> {
  code: number;
  message: string;
  data?: T;
}

@Injectable()
export class TransformResponseInterceptor<T> implements NestInterceptor<
  T,
  Response<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    return next.handle().pipe(
      map((data) => {
        // 如果响应已经是标准格式，直接返回
        if (data && typeof data === "object" && "code" in data) {
          return data;
        }

        // 如果是文件流或特殊响应（包括 StreamableFile），不转换
        if (data instanceof Buffer || data?.pipe || data instanceof StreamableFile) {
          return data;
        }

        return {
          code: 0,
          message: "成功",
          data,
        };
      }),
    );
  }
}
