import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { V1UserController } from './user.controller';
import { V1UserService } from './user.service';

@Module({
  imports: [PrismaModule],
  controllers: [V1UserController],
  providers: [V1UserService],
  exports: [V1UserService],
})
export class V1UserModule {}
