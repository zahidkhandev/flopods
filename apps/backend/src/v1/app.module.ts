// v1/app.module.ts
import { Module } from '@nestjs/common';
import { V1ServerModule } from './server/server.module';

@Module({
  imports: [
    // ALL your V1 modules
    V1ServerModule,
  ],
  providers: [
    // {
    //   provide: APP_GUARD,
    //   useClass: AccessTokenGuard,
    // },
  ],
  exports: [
    // export if needed by the root or other modules
    V1ServerModule,
  ],
})
export class V1AppModule {}
