// execution.module.ts

import { Module } from '@nestjs/common';
import { ExecutionService } from './execution.service';
import { ExecutionQueueService } from './execution-queue.service';
import { V1ExecutionController } from './execution.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProviderModule } from './providers/provider.module';
import { V1FlowModule } from '../flow/flow.module';
import { AwsModule } from '../../common/aws/aws.module';

@Module({
  imports: [PrismaModule, AwsModule, ProviderModule, V1FlowModule],
  controllers: [V1ExecutionController],
  providers: [ExecutionService, ExecutionQueueService],
  exports: [ExecutionService, ExecutionQueueService],
})
export class ExecutionModule {}
