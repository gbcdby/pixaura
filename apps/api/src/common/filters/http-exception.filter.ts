import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  ValidationError,
} from "@nestjs/common";
import { FastifyReply } from "fastify";

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // 构建统一错误响应
    const errorResponse = {
      code: this.getErrorCode(status, exceptionResponse),
      message: this.getErrorMessage(exceptionResponse),
      errors: this.getValidationErrors(exceptionResponse),
    };

    response.status(status).send(errorResponse);
  }

  private getErrorCode(status: number, response: string | object): number {
    // 如果响应中有自定义 code，使用它
    if (typeof response === "object" && "code" in response) {
      return (response as any).code;
    }

    // 根据状态码映射错误码
    const codeMap: Record<number, number> = {
      [HttpStatus.BAD_REQUEST]: 2, // 参数错误
      [HttpStatus.UNAUTHORIZED]: 3, // 未登录
      [HttpStatus.FORBIDDEN]: 4, // 无权限
      [HttpStatus.NOT_FOUND]: 5, // 资源不存在
      [HttpStatus.CONFLICT]: 6, // 资源冲突
      [HttpStatus.UNPROCESSABLE_ENTITY]: 7, // 无法处理
      [HttpStatus.TOO_MANY_REQUESTS]: 8, // 请求过于频繁
      [HttpStatus.INTERNAL_SERVER_ERROR]: 9, // 服务器错误
    };

    return codeMap[status] || 9;
  }

  private getErrorMessage(response: string | object): string {
    if (typeof response === "string") {
      return response;
    }
    if (typeof response === "object") {
      if ("message" in response) {
        const message = (response as any).message;
        if (Array.isArray(message)) {
          return message[0] || "请求参数错误";
        }
        return message;
      }
    }
    return "请求失败";
  }

  private getValidationErrors(response: string | object): any[] | undefined {
    if (typeof response === "object" && "errors" in response) {
      return (response as any).errors;
    }
    // 处理 class-validator 的错误格式
    if (typeof response === "object" && "message" in response) {
      const message = (response as any).message;
      if (Array.isArray(message) && message.length > 0) {
        // 尝试解析验证错误
        return message.map((msg: string) => ({
          message: msg,
        }));
      }
    }
    return undefined;
  }
}
