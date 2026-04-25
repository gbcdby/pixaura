import { HttpException, HttpStatus } from "@nestjs/common";
import { ErrorCodes, type ErrorCode } from "@pixaura/shared-types";

export class AuthException extends HttpException {
  constructor(errorCode: ErrorCode, extra?: Record<string, unknown>) {
    const errorInfo = ErrorCodes[errorCode];
    super(
      {
        code: errorInfo.code,
        message: errorInfo.message,
        ...extra,
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class ValidationException extends HttpException {
  constructor(message: string, extra?: Record<string, unknown>) {
    super(
      {
        code: ErrorCodes.INVALID_PARAMS.code,
        message: message || ErrorCodes.INVALID_PARAMS.message,
        ...extra,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class BusinessException extends HttpException {
  constructor(errorCode: ErrorCode, extra?: Record<string, unknown>) {
    const errorInfo = ErrorCodes[errorCode];
    super(
      {
        code: errorInfo.code,
        message: errorInfo.message,
        ...extra,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
