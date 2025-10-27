import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueueFactory } from './queue.factory';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [QueueFactory],
  exports: [QueueFactory],
})
export class QueueModule {}
