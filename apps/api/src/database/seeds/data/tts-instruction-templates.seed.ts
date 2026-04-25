/**
 * TTS 指令模板种子数据
 * 初始化预设的 TTS 指令模板
 *
 * 适用范围：qwen3-tts-instruct-flash 指令控制功能
 * 参考文档：docs/tts/ali/语音合成-千问.md 指令控制章节
 *
 * 编写原则：
 * - 具体而非模糊：使用能够描绘具体声音特质的词语
 * - 多维而非单一：结合音调、语速、情感、特点、用途多个维度
 * - 客观而非主观：专注声音本身的物理和感知特征
 * - 简洁而非冗余：确保每个词都有其意义
 */

import { DataSource } from "typeorm";
import { TtsInstructionTemplateEntity } from "../../../modules/tts/entities/instruction-template.entity";

interface InstructionTemplateSeedData {
  name: string;
  description: string | null;
  category: string;
  content: string;
  isSystem: boolean;
}

// 默认指令模板（严格按四个分类：emotion / style / scene / speed）
const defaultTemplates: InstructionTemplateSeedData[] = [
  // ===== emotion =====
  {
    name: "温柔治愈",
    description: "语速偏慢，音调温柔甜美，语气治愈温暖",
    category: "emotion",
    content: "语速偏慢，音调温柔甜美，语气治愈温暖，像贴心朋友般关怀。",
    isSystem: true,
  },
  {
    name: "沉稳冷静",
    description: "语速适中，音调平稳，语气冷静克制",
    category: "emotion",
    content: "语速适中，音调平稳，语气冷静克制，不带明显情绪波动。",
    isSystem: true,
  },
  {
    name: "哭腔哽咽",
    description: "哭腔导致发音略微含糊，略显沙哑",
    category: "emotion",
    content: "哭腔导致发音略微含糊，略显沙哑，带有明显哭腔的紧张感。",
    isSystem: true,
  },
  // ===== speed =====
  {
    name: "快速",
    description: "语速偏快，适合紧急或信息量大的内容",
    category: "speed",
    content: "语速偏快，节奏紧凑，适合表达紧急、激动或信息量大的内容。",
    isSystem: true,
  },
  {
    name: "缓慢",
    description: "语速偏慢，适合庄重或抒情的内容",
    category: "speed",
    content: "语速偏慢，吐字清晰，适当停顿，适合表达庄重、抒情或需要仔细聆听的内容。",
    isSystem: true,
  },
  // ===== style =====
  {
    name: "磁性沙哑",
    description: "声音带有磁性和沙哑质感",
    category: "style",
    content: "声音带有磁性和沙哑质感，富有故事感和沧桑感。",
    isSystem: true,
  },
  {
    name: "清脆圆润",
    description: "声音清脆圆润，甜美饱满",
    category: "style",
    content: "声音清脆圆润，甜美饱满，带有青春活力。",
    isSystem: true,
  },
  {
    name: "高音明亮",
    description: "音调偏高，声音明亮清脆",
    category: "style",
    content: "音调偏高，声音明亮清脆，带有活力和轻快感。",
    isSystem: true,
  },
  {
    name: "低沉浑厚",
    description: "音调偏低，声音低沉浑厚",
    category: "style",
    content: "音调偏低，声音低沉浑厚，带有沉稳和权威感。",
    isSystem: true,
  },
  // ===== scene =====
  {
    name: "标准播音",
    description: "吐字清晰精准，字正腔圆",
    category: "scene",
    content: "吐字清晰精准，字正腔圆。",
    isSystem: true,
  },
  {
    name: "广告配音",
    description: "音调偏高，语速中等，充满活力和感染力",
    category: "scene",
    content: "音调偏高，语速中等，充满活力和感染力，适合广告配音。",
    isSystem: true,
  },
  {
    name: "纪录片解说",
    description: "沉稳的中年男性播音员风格，音色低沉浑厚",
    category: "scene",
    content: "沉稳的中年男性播音员风格，音色低沉浑厚，富有磁性，语速平稳，吐字清晰。",
    isSystem: true,
  },
  {
    name: "情绪递进",
    description: "音量由正常对话迅速增强至高喊",
    category: "scene",
    content: "音量由正常对话迅速增强至高喊，性格直率，情绪易激动且外露。",
    isSystem: true,
  },
];

export async function seedTtsInstructionTemplates(dataSource: DataSource): Promise<void> {
  const templateRepo = dataSource.getRepository(TtsInstructionTemplateEntity);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let deactivated = 0;

  // 1. 清理不在默认列表中的系统模板
  const defaultKeys = new Set(defaultTemplates.map((t) => `${t.name}:${t.category}`));
  const oldTemplates = await templateRepo.find({
    where: { isSystem: true },
  });
  for (const old of oldTemplates) {
    const key = `${old.name}:${old.category}`;
    if (!defaultKeys.has(key) && old.isActive) {
      old.isActive = false;
      await templateRepo.save(old);
      console.log(`  ✗ 禁用不在默认列表的指令模板: ${old.name} (${old.category})`);
      deactivated++;
    }
  }

  // 2. 创建或更新新格式指令模板
  for (const data of defaultTemplates) {
    const existing = await templateRepo.findOne({
      where: { name: data.name, category: data.category },
    });

    if (existing) {
      const needsUpdate =
        existing.description !== data.description ||
        existing.content !== data.content ||
        !existing.isActive;

      if (needsUpdate) {
        existing.description = data.description;
        existing.content = data.content;
        existing.isActive = true;
        await templateRepo.save(existing);
        console.log(`  ↻ 更新指令模板: ${data.name} (${data.category})`);
        updated++;
      } else {
        console.log(`  ↷ 跳过已存在的指令模板: ${data.name} (${data.category})`);
        skipped++;
      }
      continue;
    }

    const template = templateRepo.create({
      name: data.name,
      description: data.description,
      category: data.category,
      content: data.content,
      isSystem: data.isSystem,
      isActive: true,
    });

    await templateRepo.save(template);
    console.log(`  ✓ 创建指令模板: ${data.name} (${data.category})`);
    created++;
  }

  console.log(
    `\nTTS 指令模板: ${created} 个已创建, ${updated} 个已更新, ${skipped} 个已跳过, ${deactivated} 个旧模板已禁用`,
  );
}
