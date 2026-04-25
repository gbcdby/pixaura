import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

/**
 * 需要保持原始 key 格式的字段列表
 * 这些字段的 value 是 Record<string, unknown>，key 是用户生成的 ID（可能包含 _）
 * 拦截器不应该转换这些 key
 */
const PRESERVE_KEY_FIELDS = ["characterRegions"];

/**
 * 将 snake_case 转换为 camelCase
 * @param obj 要转换的对象
 * @param preserveKeys 是否保持当前层级的 key 不转换（用于 characterRegions 等字段）
 */
function toCamelCase(obj: unknown, preserveKeys = false): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (obj instanceof Date) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => toCamelCase(item, preserveKeys));
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // 如果当前 key 是需要保持原始格式的字段，对其 value 不进行 key 转换
      const shouldPreserveChildKeys = PRESERVE_KEY_FIELDS.includes(key);

      // 如果 preserveKeys 为 true，保持当前 key 不转换（用于 characterRegions 内部的 key）
      const camelKey = preserveKeys
        ? key
        : key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

      result[camelKey] = toCamelCase(value, shouldPreserveChildKeys);
    }
    return result;
  }

  return obj;
}

@Injectable()
export class SnakeToCamelInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      map((data) => {
        // 如果响应是标准格式，只转换 data 部分
        if (
          data &&
          typeof data === "object" &&
          "code" in data &&
          "data" in data
        ) {
          return {
            ...data,
            data: toCamelCase(data.data),
          };
        }
        return toCamelCase(data);
      }),
    );
  }
}
