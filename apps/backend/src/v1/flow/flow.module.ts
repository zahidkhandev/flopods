import { Module } from '@nestjs/common';
import { V1FlowController } from './flow.controller';
import { V1FlowService } from './flow.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [V1FlowController],
  providers: [V1FlowService],
  exports: [V1FlowService],
})
export class V1FlowModule {}
