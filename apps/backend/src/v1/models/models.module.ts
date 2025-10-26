import { Module } from '@nestjs/common';
import { V1ModelsController } from './models.controller';
import { V1ModelsService } from './models.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [V1ModelsController],
  providers: [V1ModelsService],
  exports: [V1ModelsService],
})
export class V1ModelsModule {}
