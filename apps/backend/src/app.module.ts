import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';

import { AccessTokenGuard } from './common/guards/auth';
import { PrismaModule } from './prisma/prisma.module';
import { WebSocketModule } from './common/websocket/websocket.module';
import { V1AppModule } from './v1/app.module';
import { QueueModule } from './common/queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: Number(config.get('API_RATE_LIMIT_TTL', 60)),
            limit: Number(config.get('API_RATE_LIMIT', 120)),
          },
        ],
        storage: new ThrottlerStorageRedisService(
          (() => {
            const host = config.get<string>('REDIS_HOST', 'localhost');
            const port = Number(config.get<number>('REDIS_PORT', 6379));
            const password = config.get<string>('REDIS_PASSWORD');
            const tlsEnabled = config.get<string>('REDIS_TLS_ENABLED') === 'true';
            const protocol = tlsEnabled ? 'rediss' : 'redis';
            const auth = password ? `:${encodeURIComponent(password)}@` : '';
            return `${protocol}://${auth}${host}:${port}`;
          })(),
        ),
      }),
    }),
    QueueModule,
    PrismaModule,
    ScheduleModule.forRoot(),
    WebSocketModule,
    V1AppModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AccessTokenGuard,
    },
  ],
})
export class AppModule {}
