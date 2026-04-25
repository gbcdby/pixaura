/**
 * 默认模型种子数据
 */

import { DataSource } from "typeorm";
import {
	AiModel,
	ModelProvider,
	Provider,
} from "../../../modules/model-config/entities";

export interface PerTokenCostConfig extends Record<string, unknown> {
	billingMode: "per_token";
	costPer1kTokens: number;
	pricePer1kTokens: number;
}

export interface PerCallCostConfig extends Record<string, unknown> {
	billingMode: "per_call";
	costPerCall: number;
	pricePerCall: number;
}

export interface PerSecondCostConfig extends Record<string, unknown> {
	billingMode: "per_second";
	costPerSecond: number;
	pricePerSecond: number;
}

export interface ModelSeedData {
	modelId: string;
	modelName: string;
	category:
		| "TEXT_GENERATION"
		| "IMAGE_GENERATION"
		| "VIDEO_GENERATION"
		| "AUDIO_GENERATION"
		| "VOICE_GENERATION";
	description: string;
	minTier: "free" | "basic" | "pro";
	isDefault: boolean;
	defaultParams: Record<string, unknown>;
	customParams: Record<string, unknown>;
	costConfig: PerTokenCostConfig | PerCallCostConfig | PerSecondCostConfig;
	supportedFeatures: string[];
	providers: {
		providerId: string;
		providerModelId: string;
		isPrimary: boolean;
		priority: number;
	}[];
}

export const defaultModels: ModelSeedData[] = [
	{
		modelId: "glm-5",
		modelName: "glm-5",
		category: "TEXT_GENERATION",
		description: "",
		minTier: "free",
		isDefault: true,
		defaultParams: {
			max_tokens: 8000,
			temperature: 0.7,
		},
		customParams: {},
		costConfig: {
			billingMode: "per_token",
			costPer1kTokens: 0,
			pricePer1kTokens: 0,
		},
		supportedFeatures: [],
		providers: [
			{
				providerId: "bailian",
				providerModelId: "glm-5",
				isPrimary: true,
				priority: 1,
			},
		],
	},
	{
		modelId: "deepseek-v4-pro",
		modelName: "deepseek-v4-pro",
		category: "TEXT_GENERATION",
		description: "",
		minTier: "free",
		isDefault: false,
		defaultParams: {
			max_tokens: 8000,
			temperature: 0.7,
		},
		customParams: {},
		costConfig: {
			billingMode: "per_token",
			costPer1kTokens: 0,
			pricePer1kTokens: 0,
		},
		supportedFeatures: [],
		providers: [
			{
				providerId: "bailian",
				providerModelId: "deepseek-v4-pro",
				isPrimary: true,
				priority: 1,
			},
		],
	},
	{
		modelId: "seedance-2.0-reference-to-video",
		modelName: "seedance-2.0-reference-to-video",
		category: "VIDEO_GENERATION",
		description: "",
		minTier: "free",
		isDefault: true,
		defaultParams: {
			quality: "720p",
			duration: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
			aspect_ratio: "16:9",
			generate_audio: false,
			generation_mode: "multi_reference",
			max_references_audios: 3,
			max_references_images: 9,
			max_references_videos: 0,
		},
		customParams: {},
		costConfig: {
			billingMode: "per_second",
			costPerSecond: 1.34,
			pricePerSecond: 2,
		},
		supportedFeatures: [],
		providers: [
			{
				providerId: "evolink",
				providerModelId: "seedance-2.0-reference-to-video",
				isPrimary: true,
				priority: 1,
			},
		],
	},
	{
		modelId: "kling-o3-image-to-video",
		modelName: "kling-o3-image-to-video",
		category: "VIDEO_GENERATION",
		description: "",
		minTier: "free",
		isDefault: false,
		defaultParams: {
			quality: "720p",
			duration: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
			aspect_ratio: "16:9",
			generate_audio: false,
			generation_mode: "multi_reference",
			max_references_audios: 0,
			max_references_images: 7,
			max_references_videos: 0,
		},
		customParams: {
			sound: "on",
		},
		costConfig: {
			billingMode: "per_second",
			costPerSecond: 0.72,
			pricePerSecond: 1.2,
		},
		supportedFeatures: [],
		providers: [
			{
				providerId: "evolink",
				providerModelId: "kling-o3-image-to-video",
				isPrimary: true,
				priority: 1,
			},
		],
	},
	{
		modelId: "qwen-image-2.0-pro-2026-04-22",
		modelName: "qwen-image-2.0-pro-2026-04-22",
		category: "IMAGE_GENERATION",
		description: "",
		minTier: "free",
		isDefault: false,
		defaultParams: {
			number: 1,
			quality: "1k",
			size_mode: "pixel",
			image_size: "1:1",
			max_references: 6,
		},
		customParams: {},
		costConfig: {
			billingMode: "per_call",
			costPerCall: 0,
			pricePerCall: 0,
		},
		supportedFeatures: [],
		providers: [
			{
				providerId: "bailian",
				providerModelId: "qwen-image-2.0-pro-2026-04-22",
				isPrimary: true,
				priority: 1,
			},
		],
	},
	{
		modelId: "nano-banana-2-beta",
		modelName: "nano-banana-2-beta",
		category: "IMAGE_GENERATION",
		description: "",
		minTier: "free",
		isDefault: true,
		defaultParams: {
			number: 1,
			quality: "1k",
			size_mode: "ratio",
			image_size: "1:1",
			max_references: 14,
		},
		customParams: {},
		costConfig: {
			billingMode: "per_call",
			costPerCall: 0.24,
			pricePerCall: 0.4,
		},
		supportedFeatures: [],
		providers: [
			{
				providerId: "evolink",
				providerModelId: "nano-banana-2-beta",
				isPrimary: true,
				priority: 1,
			},
		],
	},
	{
		modelId: "gemini-3.1-flash-image-preview",
		modelName: "nano-banana-2",
		category: "IMAGE_GENERATION",
		description: "",
		minTier: "free",
		isDefault: true,
		defaultParams: {
			number: 1,
			quality: "1k",
			size_mode: "ratio",
			image_size: "1:1",
			max_references: 14,
		},
		customParams: {},
		costConfig: {
			billingMode: "per_call",
			costPerCall: 0.42,
			pricePerCall: 0.8,
		},
		supportedFeatures: [],
		providers: [
			{
				providerId: "evolink",
				providerModelId: "gemini-3.1-flash-image-preview",
				isPrimary: true,
				priority: 1,
			},
		],
	},
];

export async function seedModels(dataSource: DataSource): Promise<void> {
	const modelRepo = dataSource.getRepository(AiModel);
	const modelProviderRepo = dataSource.getRepository(ModelProvider);
	const providerRepo = dataSource.getRepository(Provider);

	let created = 0;
	let skipped = 0;

	for (const data of defaultModels) {
		const existing = await modelRepo.findOne({
			where: { modelId: data.modelId },
		});

		if (existing) {
			console.log(`  ↷ 跳过已存在的模型: ${data.modelName} (${data.modelId})`);
			skipped++;
			continue;
		}

		const model = modelRepo.create({
			modelId: data.modelId,
			modelName: data.modelName,
			category: data.category,
			description: data.description,
			minTier: data.minTier,
			isDefault: data.isDefault,
			status: "enabled",
			defaultParams: data.defaultParams,
			customParams: data.customParams,
			costConfig: data.costConfig,
			supportedFeatures: data.supportedFeatures,
		});

		await modelRepo.save(model);
		console.log(`  ✓ 创建模型: ${data.modelName} (${data.modelId})`);

		for (const providerData of data.providers) {
			const provider = await providerRepo.findOne({
				where: { providerId: providerData.providerId },
			});

			if (!provider) {
				console.log(`    ⚠ 供应商不存在，跳过关联: ${providerData.providerId}`);
				continue;
			}

			const modelProvider = modelProviderRepo.create({
				modelId: data.modelId,
				providerId: providerData.providerId,
				isPrimary: providerData.isPrimary,
				priority: providerData.priority,
				providerModelId: providerData.providerModelId,
				status: "enabled",
			});

			await modelProviderRepo.save(modelProvider);
			console.log(`    ✓ 关联供应商: ${providerData.providerId}`);
		}

		created++;
	}

	console.log(`\n模型: ${created} 个已创建, ${skipped} 个已跳过`);
}
