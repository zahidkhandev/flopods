import { Module } from '@nestjs/common';
import { V1NotificationController } from './notification.controller';
import { V1NotificationService } from './notification.service';
import { V1NotificationGateway } from './notification.gateway';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [V1NotificationController],
  providers: [V1NotificationService, V1NotificationGateway],
  exports: [V1NotificationService, V1NotificationGateway],
})
export class V1NotificationModule {}
