// execution.module.ts

import { Module } from '@nestjs/common';
import { V1ExecutionService } from './execution.service';
import { V1ExecutionController } from './execution.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProviderModule } from './providers/provider.module';
import { V1FlowModule } from '../flow/flow.module';
import { AwsModule } from '../../common/aws/aws.module';
import { V1ContextResolutionService } from './context-resolution.service';
import { ProviderFactory } from './providers/provider.factory';
import { ApiKeyEncryptionService } from '../../common/services/encryption.service';
import { forwardRef } from '@nestjs/common';
import { V1PodModule } from '../pods/pod.module';
@Module({
  imports: [PrismaModule, AwsModule, ProviderModule, V1FlowModule, forwardRef(() => V1PodModule)],
  controllers: [V1ExecutionController],
  providers: [
    V1ExecutionService,
    V1ContextResolutionService,
    ProviderFactory,
    ApiKeyEncryptionService,
  ],
  exports: [V1ExecutionService, V1ContextResolutionService],
})
export class V1ExecutionModule {}
