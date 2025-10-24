import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

interface FlowSession {
  userId: string;
  socketId: string;
  flowId: string;
  userName?: string;
  userColor?: string;
}

/**
 * Unified WebSocket Gateway for Flow Canvas
 * Handles: Connection management, pod updates, edge updates, collaboration
 */
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
  namespace: 'flows',
  transports: ['websocket', 'polling'],
})
export class V1FlowGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(V1FlowGateway.name);
  private flowSessions = new Map<string, Map<string, FlowSession>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit(): void {
    this.logger.log('🔌 Flow WebSocket Gateway initialized');
  }

  // ==================== CONNECTION MANAGEMENT ====================

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
      const userId = payload.userId || payload.sub;

      if (!userId) {
        this.logger.warn(`❌ Client ${client.id}: Invalid token`);
        client.disconnect(true);
        return;
      }

      client.data.userId = userId;
      client.emit('connected', { message: 'Connected to flows', userId });

      this.logger.log(`✅ User ${userId} connected to flows`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Auth failed';
      this.logger.error(`❌ Connection failed: ${errorMessage}`);
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const userId = client.data.userId;
    const flowId = client.data.flowId;

    if (flowId && userId) {
      const sessions = this.flowSessions.get(flowId);
      if (sessions) {
        sessions.delete(client.id);
        if (sessions.size === 0) {
          this.flowSessions.delete(flowId);
        }

        this.server.to(`flow:${flowId}`).emit('user:left', {
          userId,
          socketId: client.id,
        });

        this.logger.log(`🔌 User ${userId} left flow ${flowId}`);
      }
    }
  }

  // ==================== FLOW ROOM MANAGEMENT ====================

  @SubscribeMessage('flow:join')
  async handleJoinFlow(
    @MessageBody() data: { flowId: string; userName?: string; userColor?: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const { flowId, userName, userColor } = data;
    const userId = client.data.userId;

    await client.join(`flow:${flowId}`);
    client.data.flowId = flowId;

    if (!this.flowSessions.has(flowId)) {
      this.flowSessions.set(flowId, new Map());
    }

    const session: FlowSession = {
      userId,
      socketId: client.id,
      flowId,
      userName,
      userColor,
    };

    this.flowSessions.get(flowId)!.set(client.id, session);

    // Notify others that user joined
    client.to(`flow:${flowId}`).emit('user:joined', session);

    // Send current users to the new joiner
    const currentUsers = Array.from(this.flowSessions.get(flowId)!.values());
    client.emit('flow:users', currentUsers);

    this.logger.log(`📊 User ${userId} joined flow ${flowId}`);
  }

  @SubscribeMessage('flow:leave')
  handleLeaveFlow(@ConnectedSocket() client: Socket): void {
    const flowId = client.data.flowId;
    const userId = client.data.userId;

    if (flowId) {
      client.leave(`flow:${flowId}`);
      const sessions = this.flowSessions.get(flowId);
      if (sessions) {
        sessions.delete(client.id);
        if (sessions.size === 0) {
          this.flowSessions.delete(flowId);
        }
      }

      client.to(`flow:${flowId}`).emit('user:left', {
        userId,
        socketId: client.id,
      });

      client.data.flowId = null;
      this.logger.log(`🔌 User ${userId} left flow ${flowId}`);
    }
  }

  // ==================== POD OPERATIONS ====================

  @SubscribeMessage('pod:create')
  handlePodCreate(@MessageBody() data: { pod: any }, @ConnectedSocket() client: Socket): void {
    const flowId = client.data.flowId;
    if (!flowId) return;

    // Broadcast to all OTHER users in the flow
    client.to(`flow:${flowId}`).emit('pod:created', {
      pod: data.pod,
      userId: client.data.userId,
    });

    this.logger.debug(`📦 Pod created in flow ${flowId}`);
  }

  @SubscribeMessage('pod:update')
  handlePodUpdate(
    @MessageBody() data: { podId: string; updates: any },
    @ConnectedSocket() client: Socket,
  ): void {
    const flowId = client.data.flowId;
    if (!flowId) return;

    client.to(`flow:${flowId}`).emit('pod:updated', {
      podId: data.podId,
      updates: data.updates,
      userId: client.data.userId,
    });

    this.logger.debug(`📦 Pod ${data.podId} updated in flow ${flowId}`);
  }

  @SubscribeMessage('pod:delete')
  handlePodDelete(@MessageBody() data: { podId: string }, @ConnectedSocket() client: Socket): void {
    const flowId = client.data.flowId;
    if (!flowId) return;

    client.to(`flow:${flowId}`).emit('pod:deleted', {
      podId: data.podId,
      userId: client.data.userId,
    });

    this.logger.debug(`📦 Pod ${data.podId} deleted in flow ${flowId}`);
  }

  @SubscribeMessage('pod:move')
  handlePodMove(
    @MessageBody() data: { podId: string; position: { x: number; y: number } },
    @ConnectedSocket() client: Socket,
  ): void {
    const flowId = client.data.flowId;
    if (!flowId) return;

    client.to(`flow:${flowId}`).emit('pod:moved', {
      podId: data.podId,
      position: data.position,
      userId: client.data.userId,
    });
  }

  @SubscribeMessage('pod:lock')
  handlePodLock(@MessageBody() data: { podId: string }, @ConnectedSocket() client: Socket): void {
    const flowId = client.data.flowId;
    if (!flowId) return;

    client.to(`flow:${flowId}`).emit('pod:locked', {
      podId: data.podId,
      userId: client.data.userId,
    });
  }

  @SubscribeMessage('pod:unlock')
  handlePodUnlock(@MessageBody() data: { podId: string }, @ConnectedSocket() client: Socket): void {
    const flowId = client.data.flowId;
    if (!flowId) return;

    client.to(`flow:${flowId}`).emit('pod:unlocked', {
      podId: data.podId,
      userId: client.data.userId,
    });
  }

  // ==================== EDGE OPERATIONS ====================

  @SubscribeMessage('edge:create')
  handleEdgeCreate(@MessageBody() data: { edge: any }, @ConnectedSocket() client: Socket): void {
    const flowId = client.data.flowId;
    if (!flowId) return;

    client.to(`flow:${flowId}`).emit('edge:created', {
      edge: data.edge,
      userId: client.data.userId,
    });

    this.logger.debug(`🔗 Edge created in flow ${flowId}`);
  }

  @SubscribeMessage('edge:delete')
  handleEdgeDelete(
    @MessageBody() data: { edgeId: string },
    @ConnectedSocket() client: Socket,
  ): void {
    const flowId = client.data.flowId;
    if (!flowId) return;

    client.to(`flow:${flowId}`).emit('edge:deleted', {
      edgeId: data.edgeId,
      userId: client.data.userId,
    });

    this.logger.debug(`🔗 Edge ${data.edgeId} deleted in flow ${flowId}`);
  }

  // ==================== CURSOR & SELECTION ====================

  @SubscribeMessage('cursor:move')
  handleCursorMove(
    @MessageBody() data: { position: { x: number; y: number } },
    @ConnectedSocket() client: Socket,
  ): void {
    const flowId = client.data.flowId;
    if (!flowId) return;

    client.to(`flow:${flowId}`).emit('cursor:updated', {
      userId: client.data.userId,
      position: data.position,
      socketId: client.id,
    });
  }

  @SubscribeMessage('selection:change')
  handleSelectionChange(
    @MessageBody() data: { selectedPodIds: string[] },
    @ConnectedSocket() client: Socket,
  ): void {
    const flowId = client.data.flowId;
    if (!flowId) return;

    client.to(`flow:${flowId}`).emit('selection:changed', {
      userId: client.data.userId,
      selectedPodIds: data.selectedPodIds,
      socketId: client.id,
    });
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Broadcast message to all users in a flow
   */
  broadcastToFlow(flowId: string, event: string, data: any): void {
    this.server.to(`flow:${flowId}`).emit(event, data);
  }

  /**
   * Get number of active users in a flow
   */
  getFlowUserCount(flowId: string): number {
    return this.flowSessions.get(flowId)?.size || 0;
  }

  /**
   * Get number of active flows
   */
  getActiveFlowsCount(): number {
    return this.flowSessions.size;
  }

  /**
   * Get all users in a flow
   */
  getFlowUsers(flowId: string): FlowSession[] {
    const sessions = this.flowSessions.get(flowId);
    return sessions ? Array.from(sessions.values()) : [];
  }
}
