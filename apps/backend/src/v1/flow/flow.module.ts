import { Module } from '@nestjs/common';
import { V1FlowController } from './flow.controller';
import { V1FlowService } from './flow.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { V1FlowGateway } from './flow.gateway';

@Module({
  imports: [PrismaModule],
  controllers: [V1FlowController],
  providers: [V1FlowService, V1FlowGateway],
  exports: [V1FlowService, V1FlowGateway],
})
export class V1FlowModule {}
