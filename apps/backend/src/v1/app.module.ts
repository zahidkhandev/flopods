// v1/app.module.ts
import { Module } from '@nestjs/common';
import { V1ServerModule } from './server/server.module';
import { V1AuthModule } from './auth/auth.module';
import { V1WorkspaceModule } from './workspace/workspace.module';
import { V1UserModule } from './user/user.module';

@Module({
  imports: [
    // ALL your V1 modules
    V1ServerModule,
    V1AuthModule,
    V1WorkspaceModule,
    V1UserModule,
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
    V1WorkspaceModule,
    V1UserModule,
  ],
})
export class V1AppModule {}
