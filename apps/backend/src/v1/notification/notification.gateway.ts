import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
  namespace: 'notifications',
  transports: ['websocket', 'polling'],
})
export class V1NotificationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(V1NotificationGateway.name);
  private userSockets = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit(): void {
    this.logger.log('🔌 Notification WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '') ||
        client.handshake.query?.token;

      if (!token) {
        this.logger.warn(`❌ Client ${client.id}: No token`);
        client.emit('error', { message: 'Authentication required' });
        client.disconnect(true);
        return;
      }

      const secret = this.configService.get<string>('JWT_ACCESS_TOKEN_SECRET');
      const payload = await this.jwtService.verifyAsync(token, { secret });

      // ✅ Use userId instead of sub (matches your JWT payload structure)
      const userId = payload.userId || payload.sub;

      if (!userId) {
        this.logger.warn(`❌ Client ${client.id}: Invalid token - no userId in payload`);
        client.disconnect(true);
        return;
      }

      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);

      await client.join(`user:${userId}`);
      client.data.userId = userId;

      client.emit('connected', {
        message: 'Connected to notifications',
        userId,
      });

      const deviceCount = this.userSockets.get(userId)!.size;
      this.logger.log(`✅ User ${userId} connected [${deviceCount} device(s)]`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Auth failed';
      this.logger.error(`❌ Connection failed: ${errorMessage}`);
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const userId = client.data.userId;
    if (userId) {
      const userSocketSet = this.userSockets.get(userId);
      if (userSocketSet) {
        userSocketSet.delete(client.id);
        if (userSocketSet.size === 0) {
          this.userSockets.delete(userId);
          this.logger.log(`🔌 User ${userId} fully disconnected`);
        } else {
          this.logger.log(
            `🔌 User ${userId} device disconnected [${userSocketSet.size} remaining]`,
          );
        }
      }
    }
  }

  sendNotificationToUser(userId: string, notification: any): void {
    try {
      this.server.to(`user:${userId}`).emit('notification:new', notification);
      const deviceCount = this.userSockets.get(userId)?.size || 0;
      this.logger.debug(`📤 Notification sent to ${userId} [${deviceCount} device(s)]`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Failed to send notification: ${errorMessage}`);
    }
  }

  sendUnreadCountUpdate(userId: string, count: number): void {
    try {
      this.server.to(`user:${userId}`).emit('notification:unread_count', count);
      this.logger.debug(`📊 Unread count updated: ${userId} = ${count}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Failed to send unread count: ${errorMessage}`);
    }
  }

  getConnectedUsersCount(): number {
    return this.userSockets.size;
  }

  isUserConnected(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
  }

  getUserDeviceCount(userId: string): number {
    return this.userSockets.get(userId)?.size || 0;
  }
}
