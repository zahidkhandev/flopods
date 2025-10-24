import { Module, forwardRef } from '@nestjs/common';
import { V1PodController } from './pod.controller';
import { V1PodService } from './pod.service';
import { V1EdgeService } from './edge.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AwsModule } from '../../common/aws/aws.module';
import { V1FlowModule } from '../flow/flow.module';

@Module({
  imports: [PrismaModule, AwsModule, forwardRef(() => V1FlowModule)],
  controllers: [V1PodController],
  providers: [V1PodService, V1EdgeService],
  exports: [V1PodService, V1EdgeService],
})
export class V1PodModule {}
