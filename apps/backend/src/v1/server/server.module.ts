import { Module } from '@nestjs/common';
import { V1HealthModule as V1HealthModule } from './health/health.module';

@Module({
  imports: [V1HealthModule],
  exports: [V1HealthModule],
})
export class V1ServerModule {}
