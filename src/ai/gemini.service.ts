import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenAI,
  type CallableTool,
  type Content,
} from '@google/genai';

@Injectable()
export class GeminiService implements OnModuleInit {
  private ai!: GoogleGenAI;
  private readonly logger = new Logger(GeminiService.name);

  constructor(private config: ConfigService) {}

  onModuleInit() {
    this.ai = new GoogleGenAI({
      apiKey: this.config.get('GEMINI_API_KEY')!,
    });
  }

  async generateResponse(params: {
    systemInstruction: string;
    conversationHistory: Array<{ role: 'user' | 'model'; content: string }>;
    userMessage: string;
    temperature?: number;
  }): Promise<string> {
    const contents = [
      ...params.conversationHistory.map((msg) => ({
        role: msg.role as 'user' | 'model',
        parts: [{ text: msg.content }],
      })),
      {
        role: 'user' as const,
        parts: [{ text: params.userMessage }],
      },
    ];

    try {
      const response = await this.ai.models.generateContent({
        model: this.config.get('GEMINI_MODEL') || 'gemini-2.5-flash',
        contents,
        config: {
          systemInstruction: params.systemInstruction,
          temperature: params.temperature ?? 0.9,
          topP: 0.95,
          frequencyPenalty: 0.7,
          presencePenalty: 0.5,
        },
      });

      return response.text?.trim() || '';
    } catch (error) {
      this.logger.error('Gemini API error', error);
      throw error;
    }
  }

  async generateResponseWithTools(params: {
    systemInstruction: string;
    conversationHistory: Array<{ role: 'user' | 'model'; content: string }>;
    userMessage: string;
    tools: CallableTool[];
  }): Promise<string> {
    const contents: Content[] = [
      ...params.conversationHistory.map((msg) => ({
        role: msg.role as 'user' | 'model',
        parts: [{ text: msg.content }],
      })),
      {
        role: 'user' as const,
        parts: [{ text: params.userMessage }],
      },
    ];

    try {
      const response = await this.ai.models.generateContent({
        model: this.config.get('GEMINI_MODEL') || 'gemini-2.5-flash',
        contents,
        config: {
          systemInstruction: params.systemInstruction,
          temperature: 0.9,
          topP: 0.95,
          frequencyPenalty: 0.7,
          presencePenalty: 0.5,
          tools: params.tools,
          automaticFunctionCalling: {
            maximumRemoteCalls: 5,
          },
        },
      });

      return response.text?.trim() || '';
    } catch (error) {
      this.logger.error('Gemini API error (with tools)', error);
      throw error;
    }
  }
}
