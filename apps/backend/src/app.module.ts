import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { AccessTokenGuard } from './common/guards/auth';
import { PrismaModule } from './prisma/prisma.module';
import { WebSocketModule } from './common/websocket/websocket.module';
import { V1AppModule } from './v1/app.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    PrismaModule,
    ScheduleModule.forRoot(),
    WebSocketModule,
    V1AppModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AccessTokenGuard,
    },
  ],
})
export class AppModule {}
