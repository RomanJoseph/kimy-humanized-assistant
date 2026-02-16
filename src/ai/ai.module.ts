import { Module } from '@nestjs/common';
import { GeminiService } from './gemini.service.js';
import { PromptBuilderService } from './prompt-builder.service.js';
import { MemoryService } from './memory.service.js';

@Module({
  providers: [GeminiService, PromptBuilderService, MemoryService],
  exports: [GeminiService, PromptBuilderService, MemoryService],
})
export class AiModule {}
