import { PipeTransform, Injectable, BadRequestException } from "@nestjs/common";
import { z, ZodSchema } from "zod";

/**
 * Zod 验证管道
 * 使用 Zod Schema 验证请求数据
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.errors
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join(", ");
        throw new BadRequestException(`验证失败: ${message}`);
      }
      throw new BadRequestException("验证失败");
    }
  }
}
