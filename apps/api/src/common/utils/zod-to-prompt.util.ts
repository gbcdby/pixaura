/**
 * Zod Schema → Prompt JSON 示例 转换工具
 *
 * 从 Zod Schema 生成带中文注释的 JSON 示例文本，
 * 用于插入 AI Prompt 中，确保输出结构与校验规则保持一致。
 *
 * 支持类型：ZodString / ZodNumber / ZodBoolean / ZodEnum /
 *           ZodOptional / ZodDefault / ZodArray / ZodObject / ZodNullable / ZodUnion
 */

import { z } from "zod";

export interface ZodToJsonOptions {
  /** 当前缩进级别 */
  indent?: number;
  /** 是否包含字段注释（describe） */
  includeDescriptions?: boolean;
  /** 字段示例值覆盖（扁平键名 → 示例值） */
  fieldExamples?: Record<string, unknown>;
  /** 是否标记可选字段 */
  markOptional?: boolean;
}

/** 内部递归上下文 */
interface ProcessContext extends ZodToJsonOptions {
  _key?: string;
  _isOptional?: boolean;
}

function getZodTypeName(schema: z.ZodTypeAny): string | undefined {
  return (schema as unknown as { _def: { typeName?: string } })._def
    .typeName;
}

function makeComment(
  desc: string | undefined,
  isOptional: boolean | undefined,
  includeDescriptions: boolean,
  markOptional: boolean,
): string {
  const parts: string[] = [];
  if (includeDescriptions && desc) parts.push(desc);
  if (markOptional && isOptional) parts.push("可选");
  return parts.length > 0 ? `  // ${parts.join("，")}` : "";
}

/**
 * 内部递归处理函数
 */
function processSchema(
  schema: z.ZodTypeAny,
  ctx: ProcessContext,
): string {
  const typeName = getZodTypeName(schema);
  const prefix = "  ".repeat(ctx.indent ?? 0);
  const desc = schema.description;
  const comment = makeComment(
    desc,
    ctx._isOptional,
    ctx.includeDescriptions ?? true,
    ctx.markOptional ?? true,
  );

  switch (typeName) {
    case "ZodString": {
      const example = String(
        ctx.fieldExamples?.[ctx._key ?? ""] ??
          (desc ? desc.slice(0, 15) : "string"),
      );
      return `"${example}"${comment}`;
    }

    case "ZodNumber": {
      const example = Number(ctx.fieldExamples?.[ctx._key ?? ""] ?? 1);
      return `${example}${comment}`;
    }

    case "ZodBoolean": {
      const example = ctx.fieldExamples?.[ctx._key ?? ""] ?? true;
      return `${example}${comment}`;
    }

    case "ZodEnum": {
      const values =
        (
          schema as unknown as {
            _def: { values?: string[] };
          }
        )._def.values ?? ["value"];
      const example = String(
        ctx.fieldExamples?.[ctx._key ?? ""] ?? values[0] ?? "value",
      );
      const enumDesc = desc
        ? `${desc}；可选值: ${values.join(" / ")}`
        : `可选值: ${values.join(" / ")}`;
      return `"${example}"${makeComment(
        enumDesc,
        ctx._isOptional,
        ctx.includeDescriptions ?? true,
        ctx.markOptional ?? true,
      )}`;
    }

    case "ZodOptional":
    case "ZodNullable": {
      const inner = (
        schema as unknown as {
          _def: { innerType?: z.ZodTypeAny };
        }
      )._def.innerType;
      if (!inner) return `"unknown"`;
      return processSchema(inner, { ...ctx, _isOptional: true });
    }

    case "ZodDefault": {
      const inner = (
        schema as unknown as {
          _def: { innerType?: z.ZodTypeAny };
        }
      )._def.innerType;
      if (!inner) return `"unknown"`;
      return processSchema(inner, ctx);
    }

    case "ZodArray": {
      const elementType = (
        schema as unknown as {
          _def: { type?: z.ZodTypeAny };
        }
      )._def.type;
      if (!elementType) return `[]${comment}`;

      const elementJson = processSchema(elementType, {
        ...ctx,
        indent: (ctx.indent ?? 0) + 1,
      });

      return `[
${prefix}  ${elementJson}
${prefix}]${comment}`;
    }

    case "ZodObject": {
      const shape = (
        schema as unknown as {
          _def: { shape: () => Record<string, z.ZodTypeAny> };
        }
      )._def.shape();
      const entries = Object.entries(shape);
      if (entries.length === 0) return `{}${comment}`;

      const lines = entries.map(([key, fieldSchema]) => {
        const fieldJson = processSchema(fieldSchema, {
          ...ctx,
          indent: (ctx.indent ?? 0) + 1,
          _key: key,
        });
        return `${prefix}  "${key}": ${fieldJson}`;
      });

      return `{
${lines.join(",\n")}
${prefix}}${comment}`;
    }

    case "ZodLiteral": {
      const value = (
        schema as unknown as {
          _def: { value?: unknown };
        }
      )._def.value;
      return `${JSON.stringify(value)}${comment}`;
    }

    case "ZodUnion": {
      const options = (
        schema as unknown as {
          _def: { options?: z.ZodTypeAny[] };
        }
      )._def.options;
      if (options && options.length > 0) {
        return processSchema(options[0], ctx);
      }
      return `"union"${comment}`;
    }

    default:
      return `"${typeName ?? "unknown"}"${comment}`;
  }
}

/**
 * 将 Zod Schema 转换为 JSON 示例字符串
 *
 * @param schema Zod Schema
 * @param options 配置选项
 * @returns 带缩进和注释的 JSON 示例文本
 *
 * @example
 * const schema = z.object({ name: z.string(), age: z.number().optional() });
 * const json = zodSchemaToJsonExample(schema, {
 *   fieldExamples: { name: "张三", age: 25 }
 * });
 * // 输出:
 * // {
 * //   "name": "张三",
 * //   "age": 25  // 可选
 * // }
 */
export function zodSchemaToJsonExample(
  schema: z.ZodTypeAny,
  options: ZodToJsonOptions = {},
): string {
  return processSchema(schema, options);
}
