// v1/app.module.ts
import { Module } from '@nestjs/common';
import { V1ServerModule } from './server/server.module';
import { V1AuthModule } from './auth/auth.module';
import { V1WorkspaceModule } from './workspace/workspace.module';
import { V1UserModule } from './user/user.module';
import { V1NotificationModule } from './notification/notification.module';
import { V1FlowModule } from './flow/flow.module';
import { V1ExecutionModule } from './execution/execution.module';
import { V1PodModule } from './pods/pod.module';
import { V1ModelsModule } from './models/models.module';

@Module({
  imports: [
    // ALL your V1 modules
    V1ServerModule,
    V1AuthModule,
    V1WorkspaceModule,
    V1UserModule,
    V1NotificationModule,
    V1FlowModule,
    V1ExecutionModule,
    V1PodModule,
    V1ModelsModule,
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
    V1NotificationModule,
    V1FlowModule,
    V1ExecutionModule,
    V1PodModule,
    V1ModelsModule,
  ],
})
export class V1AppModule {}
