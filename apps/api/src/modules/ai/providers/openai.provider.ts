import { Injectable, Logger } from "@nestjs/common";
// import OpenAI from "openai";
import type {
  AIProviderAdapter,
  TextGenerationRequest,
  TextGenerationResult,
  ImageGenerationRequest,
  ImageGenerationResult,
} from "./ai-provider.interface";

@Injectable()
export class OpenAIProvider implements AIProviderAdapter {
  private readonly logger = new Logger(OpenAIProvider.name);
  readonly name = "openai";
  readonly supportedModels = [
    "gpt-4",
    "gpt-4-turbo",
    "gpt-3.5-turbo",
    "dall-e-3",
    "dall-e-2",
  ];

  // TODO: 安装 openai 包后启用
  // private client: OpenAI | null = null;

  constructor() {
    // const apiKey = process.env.OPENAI_API_KEY;
    // if (apiKey) {
    //   this.client = new OpenAI({ apiKey });
    // }
  }

  async generateTextStream(): Promise<void> {
    throw new Error(
      "OpenAI provider not implemented yet - need to install openai package",
    );
  }

  async generateText(): Promise<TextGenerationResult> {
    throw new Error(
      "OpenAI provider not implemented yet - need to install openai package",
    );
  }

  async generateImage(): Promise<ImageGenerationResult> {
    throw new Error(
      "OpenAI provider not implemented yet - need to install openai package",
    );
  }

  async generateVideo(): Promise<any> {
    throw new Error("OpenAI does not support video generation");
  }

  async generateAudio(): Promise<any> {
    throw new Error(
      "OpenAI does not support audio generation via this interface",
    );
  }

  async checkModelAvailability(modelId: string): Promise<boolean> {
    return this.supportedModels.includes(modelId);
  }
}
