// execution/providers/provider.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProviderFactory } from './provider.factory';
import { OpenAIProvider } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';
import { GeminiProvider } from './gemini.provider';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule, ConfigModule],
  providers: [ProviderFactory, OpenAIProvider, AnthropicProvider, GeminiProvider],
  exports: [ProviderFactory],
})
export class ProviderModule {}
