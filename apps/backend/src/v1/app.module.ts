// v1/app.module.ts
import { Module } from '@nestjs/common';
import { V1ServerModule } from './server/server.module';
import { V1AuthModule } from './auth/auth.module';

@Module({
  imports: [
    // ALL your V1 modules
    V1ServerModule,
    V1AuthModule,
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
    V1AuthModule,
  ],
})
export class V1AppModule {}
