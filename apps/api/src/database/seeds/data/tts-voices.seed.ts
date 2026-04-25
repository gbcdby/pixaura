/**
 * TTS 音色种子数据
 * 初始化千问 TTS 默认音色
 *
 * 适用范围：qwen3-tts-flash / qwen3-tts-instruct-flash 均支持的音色
 * 参考文档：docs/tts/ali/音色.md
 *
 * 说明：
 * - voiceId 与 name 均使用阿里云官方音色名称
 * - 仅包含 qwen3-tts-instruct-flash 支持的音色（两个模型兼容）
 * - 方言音色仅 qwen3-tts-flash 支持，暂不入种子
 */

import { DataSource } from "typeorm";
import { TtsVoiceEntity } from "../../../modules/tts/entities/voice.entity";

interface VoiceSeedData {
  voiceId: string;
  name: string;
  gender: string;
  style: string;
  sortOrder: number;
  previewAudioUrl: string;
}

// 千问 TTS 默认音色（qwen3-tts-flash / qwen3-tts-instruct-flash 均支持）
const defaultVoices: VoiceSeedData[] = [
    {
        "voiceId": "Cherry",
        "name": "芊悦",
        "gender": "female",
        "style": "阳光积极、亲切自然小姐姐",
        "previewAudioUrl": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250211/tixcef/cherry.wav",
        "sortOrder": 1
    },
    {
        "voiceId": "Serena",
        "name": "苏瑶",
        "gender": "female",
        "style": "温柔小姐姐",
        "previewAudioUrl": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250211/bxokea/serena.wav",
        "sortOrder": 2
    },
    {
        "voiceId": "Chelsie",
        "name": "千雪",
        "gender": "female",
        "style": "二次元虚拟女友",
        "previewAudioUrl": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250211/vnpxgw/chelsie.wav",
        "sortOrder": 3
    },
    {
        "voiceId": "Momo",
        "name": "茉兔",
        "gender": "female",
        "style": "撒娇搞怪，逗你开心",
        "previewAudioUrl": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/rvzrcx/Momo.wav",
        "sortOrder": 4
    },
    {
        "voiceId": "Vivian",
        "name": "十三",
        "gender": "female",
        "style": "拽拽的、可爱的小暴躁",
        "previewAudioUrl": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/eetwkj/Vivian.wav",
        "sortOrder": 5
    },
    {
        "voiceId": "Maia",
        "name": "四月",
        "gender": "female",
        "style": "知性与温柔的碰撞",
        "previewAudioUrl": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/fewawx/Maia.wav",
        "sortOrder": 6
    },
    {
        "voiceId": "Bella",
        "name": "萌宝",
        "gender": "female",
        "style": "喝酒不打醉拳的小萝莉",
        "previewAudioUrl": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/optibu/Bella.wav",
        "sortOrder": 7
    },
    {
        "voiceId": "Mia",
        "name": "乖小妹",
        "gender": "female",
        "style": "温顺如春水，乖巧如初雪",
        "previewAudioUrl": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/gpvlix/Mia.wav",
        "sortOrder": 8
    },
    {
        "voiceId": "Bellona",
        "name": "燕铮莺",
        "gender": "female",
        "style": "声音洪亮，吐字清晰，热血沸腾",
        "previewAudioUrl": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/wztwli/Bellona.wav",
        "sortOrder": 9
    },
    {
        "voiceId": "Bunny",
        "name": "萌小姬",
        "gender": "female",
        "style": "“萌属性”爆棚的小萝莉",
        "previewAudioUrl": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/aswewm/Bunny.wav",
        "sortOrder": 10
    },
    {
        "voiceId": "Elias",
        "name": "墨讲师",
        "gender": "female",
        "style": "严谨，叙事、知识",
        "previewAudioUrl": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/rhbvqx/Elias.wav",
        "sortOrder": 11
    },
    {
        "voiceId": "Nini",
        "name": "邻家妹妹",
        "gender": "female",
        "style": "糯米糍声线",
        "previewAudioUrl": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/lppeba/Nini.wav",
        "sortOrder": 12
    },
    {
        "voiceId": "Seren",
        "name": "小婉",
        "gender": "female",
        "style": "温和舒缓",
        "previewAudioUrl": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/xlksoe/Seren.wav",
        "sortOrder": 13
    },
    {
        "voiceId": "Stella",
        "name": "少女阿月",
        "gender": "female",
        "style": "甜到发腻、迷糊少女音",
        "previewAudioUrl": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/azikxr/Stella.wav",
        "sortOrder": 14
    },
    {
        "voiceId": "Ethan",
        "name": "晨煦",
        "gender": "male",
        "style": "北方口音、阳光、活力、朝气",
        "previewAudioUrl": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250211/emaqdp/ethan.wav",
        "sortOrder": 15
    },
    {
        "voiceId": "Moon",
        "name": "月白",
        "gender": "male",
        "style": "率性帅气的月白",
        "previewAudioUrl": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/bcaqju/Moon.wav",
        "sortOrder": 16
    },
    {
        "voiceId": "Kai",
        "name": "凯",
        "gender": "male",
        "style": "磁性、稳重",
        "previewAudioUrl": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/maiqbf/Kai.wav",
        "sortOrder": 17
    },
    {
        "voiceId": "Nofish",
        "name": "不吃鱼",
        "gender": "male",
        "style": "不会翘舌音的设计师",
        "previewAudioUrl": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/xurcmx/Nofish.wav",
        "sortOrder": 18
    },
    {
        "voiceId": "Eldric Sage",
        "name": "沧明子",
        "gender": "male",
        "style": "沉稳睿智、老者、沧桑",
        "previewAudioUrl": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/hbvhwj/Eldric+Sage.wav",
        "sortOrder": 19
    },
    {
        "voiceId": "Mochi",
        "name": "沙小弥",
        "gender": "male",
        "style": "聪明伶俐、小大人，童真未泯、禅",
        "previewAudioUrl": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/zapcpe/Mochi.wav",
        "sortOrder": 20
    },
    {
        "voiceId": "Vincent",
        "name": "田叔",
        "gender": "male",
        "style": "沙哑烟嗓、江湖豪情",
        "previewAudioUrl": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/skfrkq/Vincent.wav",
        "sortOrder": 21
    },
    {
        "voiceId": "Neil",
        "name": "阿闻",
        "gender": "male",
        "style": "平直、字正腔圆、新闻主持",
        "previewAudioUrl": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/ucmfkt/Neil.wav",
        "sortOrder": 22
    },
    {
        "voiceId": "Arthur",
        "name": "徐大爷",
        "gender": "male",
        "style": "质朴嗓音、不疾不徐",
        "previewAudioUrl": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/ynqwyu/Arthur.wav",
        "sortOrder": 23
    },
    {
        "voiceId": "Pip",
        "name": "顽屁小孩",
        "gender": "male",
        "style": "调皮捣蛋、童真、蜡笔小新",
        "previewAudioUrl": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/gqxoub/Pip.wav",
        "sortOrder": 24
    }
];

export async function seedTtsVoices(dataSource: DataSource): Promise<void> {
  const voiceRepo = dataSource.getRepository(TtsVoiceEntity);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const data of defaultVoices) {
    const existing = await voiceRepo.findOne({
      where: { voiceId: data.voiceId },
    });

    if (existing) {
      // 检查数据是否需要更新
      const needsUpdate =
        existing.name !== data.name ||
        existing.gender !== data.gender ||
        existing.category !== "standard" ||
        existing.style !== data.style ||
        existing.previewAudioUrl !== data.previewAudioUrl ||
        existing.sortOrder !== data.sortOrder;

      if (needsUpdate) {
        existing.name = data.name;
        existing.gender = data.gender;
        existing.category = "standard";
        existing.style = data.style;
        existing.previewAudioUrl = data.previewAudioUrl;
        existing.sortOrder = data.sortOrder;
        await voiceRepo.save(existing);
        console.log(`  ↻ 更新音色: ${data.name}`);
        updated++;
      } else {
        console.log(`  ↷ 跳过已存在的音色: ${data.name}`);
        skipped++;
      }
      continue;
    }

    const voice = voiceRepo.create({
      voiceId: data.voiceId,
      name: data.name,
      gender: data.gender,
      category: "standard",
      style: data.style,
      previewAudioUrl: data.previewAudioUrl,
      isActive: true,
      sortOrder: data.sortOrder,
    });

    await voiceRepo.save(voice);
    console.log(`  ✓ 创建音色: ${data.name}`);
    created++;
  }

  console.log(`\nTTS 音色: ${created} 个已创建, ${updated} 个已更新, ${skipped} 个已跳过`);
}
