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
import { Logger, UseFilters } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WsExceptionFilter } from '../../common/filters/ws-exception.filter';

interface FlowSession {
  userId: string;
  socketId: string;
  flowId: string;
  userName?: string;
  userColor?: string;
  joinedAt: Date;
}

/**
 * PRODUCTION-GRADE WebSocket Gateway for Flow Canvas
 * Features:
 * - Real-time collaboration
 * - Pod execution streaming
 * - Presence tracking
 * - Error handling
 * - Rate limiting
 * - Heartbeat monitoring
 */
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
  namespace: 'flows',
  transports: ['websocket', 'polling'],
  pingInterval: 25000, // 25 seconds
  pingTimeout: 60000, // 1 minute
  maxHttpBufferSize: 1e6, // 1MB
  perMessageDeflate: true,
})
@UseFilters(new WsExceptionFilter())
export class V1FlowGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(V1FlowGateway.name);
  private flowSessions = new Map<string, Map<string, FlowSession>>();

  // Rate limiting: max events per second per client
  private readonly rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  private readonly RATE_LIMIT = 100; // 100 events per second
  private readonly RATE_LIMIT_WINDOW = 1000; // 1 second

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit(): void {
    this.logger.log('🔌 Flow WebSocket Gateway initialized');

    // Cleanup stale sessions every 5 minutes
    setInterval(() => this.cleanupStaleSessions(), 5 * 60 * 1000);
  }

  // ==================== CONNECTION MANAGEMENT ====================

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '') ||
        client.handshake.query?.token;

      if (!token) {
        this.logger.warn(`❌ Client ${client.id}: No token provided`);
        client.emit('error', { message: 'Authentication required', code: 'NO_TOKEN' });
        client.disconnect(true);
        return;
      }

      const secret = this.configService.get<string>('JWT_ACCESS_TOKEN_SECRET');

      if (!secret) {
        this.logger.error('JWT_ACCESS_TOKEN_SECRET not configured');
        client.disconnect(true);
        return;
      }

      const payload = await this.jwtService.verifyAsync(token, { secret });
      const userId = payload.userId || payload.sub;

      if (!userId) {
        this.logger.warn(`❌ Client ${client.id}: Invalid token payload`);
        client.emit('error', { message: 'Invalid token', code: 'INVALID_TOKEN' });
        client.disconnect(true);
        return;
      }

      // Store user data on socket
      client.data.userId = userId;
      client.data.connectedAt = new Date();

      // Send connection confirmation
      client.emit('connected', {
        message: 'Connected to flows',
        userId,
        serverTime: new Date().toISOString(),
      });

      this.logger.log(`User ${userId} connected (socket: ${client.id})`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      this.logger.error(`❌ Connection failed for ${client.id}: ${errorMessage}`);
      client.emit('error', { message: 'Authentication failed', code: 'AUTH_ERROR' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const userId = client.data.userId;
    const flowId = client.data.flowId;

    if (flowId && userId) {
      const sessions = this.flowSessions.get(flowId);
      if (sessions) {
        const session = sessions.get(client.id);
        sessions.delete(client.id);

        if (sessions.size === 0) {
          this.flowSessions.delete(flowId);
          this.logger.log(`📊 Flow ${flowId} now empty, sessions cleared`);
        }

        // Notify others user left
        this.server.to(`flow:${flowId}`).emit('user:left', {
          userId,
          socketId: client.id,
          userName: session?.userName,
        });

        this.logger.log(`🔌 User ${userId} left flow ${flowId}`);
      }
    }

    // Cleanup rate limiting
    this.rateLimitMap.delete(client.id);
  }

  // ==================== FLOW ROOM MANAGEMENT ====================

  @SubscribeMessage('flow:join')
  async handleJoinFlow(
    @MessageBody() data: { flowId: string; userName?: string; userColor?: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    try {
      if (!data.flowId || typeof data.flowId !== 'string') {
        client.emit('error', { message: 'Invalid flowId', code: 'INVALID_FLOW_ID' });
        return;
      }

      const { flowId, userName, userColor } = data;
      const userId = client.data.userId;

      // Leave previous flow if any
      if (client.data.flowId && client.data.flowId !== flowId) {
        await client.leave(`flow:${client.data.flowId}`);
      }

      // Join new flow room
      await client.join(`flow:${flowId}`);
      client.data.flowId = flowId;

      // Initialize flow sessions map
      if (!this.flowSessions.has(flowId)) {
        this.flowSessions.set(flowId, new Map());
      }

      const session: FlowSession = {
        userId,
        socketId: client.id,
        flowId,
        userName,
        userColor,
        joinedAt: new Date(),
      };

      this.flowSessions.get(flowId)!.set(client.id, session);

      // Notify others user joined
      client.to(`flow:${flowId}`).emit('user:joined', session);

      // Send current users to the new joiner
      const currentUsers = Array.from(this.flowSessions.get(flowId)!.values());
      client.emit('flow:users', currentUsers);

      this.logger.log(
        `📊 User ${userId} joined flow ${flowId} (${currentUsers.length} total users)`,
      );
    } catch (error) {
      this.logger.error(`Failed to join flow:`, error);
      client.emit('error', { message: 'Failed to join flow', code: 'JOIN_ERROR' });
    }
  }

  @SubscribeMessage('flow:leave')
  handleLeaveFlow(@ConnectedSocket() client: Socket): void {
    const flowId = client.data.flowId;
    const userId = client.data.userId;

    if (flowId) {
      client.leave(`flow:${flowId}`);

      const sessions = this.flowSessions.get(flowId);
      if (sessions) {
        const session = sessions.get(client.id);
        sessions.delete(client.id);

        if (sessions.size === 0) {
          this.flowSessions.delete(flowId);
        }

        // Use session data when notifying others
        client.to(`flow:${flowId}`).emit('user:left', {
          userId,
          socketId: client.id,
          userName: session?.userName, // Include user name
        });
      } else {
        // Sessions not found, still notify
        client.to(`flow:${flowId}`).emit('user:left', {
          userId,
          socketId: client.id,
        });
      }

      client.data.flowId = null;
      this.logger.log(`🔌 User ${userId} explicitly left flow ${flowId}`);
    }
  }

  // ==================== POD OPERATIONS ====================

  @SubscribeMessage('pod:create')
  handlePodCreate(@MessageBody() data: { pod: any }, @ConnectedSocket() client: Socket): void {
    if (!this.checkRateLimit(client)) return;

    const flowId = client.data.flowId;
    if (!flowId) {
      client.emit('error', { message: 'Not in a flow', code: 'NOT_IN_FLOW' });
      return;
    }

    // Broadcast to all OTHER users in the flow
    client.to(`flow:${flowId}`).emit('pod:created', {
      pod: data.pod,
      userId: client.data.userId,
      timestamp: new Date().toISOString(),
    });

    this.logger.debug(`📦 Pod created in flow ${flowId} by user ${client.data.userId}`);
  }

  @SubscribeMessage('pod:update')
  handlePodUpdate(
    @MessageBody() data: { podId: string; updates: any },
    @ConnectedSocket() client: Socket,
  ): void {
    if (!this.checkRateLimit(client)) return;

    const flowId = client.data.flowId;
    if (!flowId) return;

    client.to(`flow:${flowId}`).emit('pod:updated', {
      podId: data.podId,
      updates: data.updates,
      userId: client.data.userId,
      timestamp: new Date().toISOString(),
    });

    this.logger.debug(`📦 Pod ${data.podId} updated in flow ${flowId}`);
  }

  @SubscribeMessage('pod:delete')
  handlePodDelete(@MessageBody() data: { podId: string }, @ConnectedSocket() client: Socket): void {
    if (!this.checkRateLimit(client)) return;

    const flowId = client.data.flowId;
    if (!flowId) return;

    client.to(`flow:${flowId}`).emit('pod:deleted', {
      podId: data.podId,
      userId: client.data.userId,
      timestamp: new Date().toISOString(),
    });

    this.logger.debug(`📦 Pod ${data.podId} deleted in flow ${flowId}`);
  }

  @SubscribeMessage('pod:move')
  handlePodMove(
    @MessageBody() data: { podId: string; position: { x: number; y: number } },
    @ConnectedSocket() client: Socket,
  ): void {
    if (!this.checkRateLimit(client)) return;

    const flowId = client.data.flowId;
    if (!flowId) return;

    // High-frequency event, only broadcast position
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
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('pod:unlock')
  handlePodUnlock(@MessageBody() data: { podId: string }, @ConnectedSocket() client: Socket): void {
    const flowId = client.data.flowId;
    if (!flowId) return;

    client.to(`flow:${flowId}`).emit('pod:unlocked', {
      podId: data.podId,
      userId: client.data.userId,
      timestamp: new Date().toISOString(),
    });
  }

  // ==================== EDGE OPERATIONS ====================

  @SubscribeMessage('edge:create')
  handleEdgeCreate(@MessageBody() data: { edge: any }, @ConnectedSocket() client: Socket): void {
    if (!this.checkRateLimit(client)) return;

    const flowId = client.data.flowId;
    if (!flowId) return;

    client.to(`flow:${flowId}`).emit('edge:created', {
      edge: data.edge,
      userId: client.data.userId,
      timestamp: new Date().toISOString(),
    });

    this.logger.debug(`🔗 Edge created in flow ${flowId}`);
  }

  @SubscribeMessage('edge:delete')
  handleEdgeDelete(
    @MessageBody() data: { edgeId: string },
    @ConnectedSocket() client: Socket,
  ): void {
    if (!this.checkRateLimit(client)) return;

    const flowId = client.data.flowId;
    if (!flowId) return;

    client.to(`flow:${flowId}`).emit('edge:deleted', {
      edgeId: data.edgeId,
      userId: client.data.userId,
      timestamp: new Date().toISOString(),
    });

    this.logger.debug(`🔗 Edge ${data.edgeId} deleted in flow ${flowId}`);
  }

  // ==================== CURSOR & SELECTION ====================

  @SubscribeMessage('cursor:move')
  handleCursorMove(
    @MessageBody() data: { position: { x: number; y: number } },
    @ConnectedSocket() client: Socket,
  ): void {
    // Very high-frequency event, skip rate limit check for cursors
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

  // ==================== EXECUTION STREAMING (NEW) ====================

  /**
   * Broadcast execution start to flow
   */
  broadcastExecutionStart(flowId: string, executionId: string, podId: string): void {
    this.server.to(`flow:${flowId}`).emit('execution:started', {
      executionId,
      podId,
      status: 'RUNNING',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast execution token stream to flow
   */
  broadcastExecutionToken(flowId: string, executionId: string, podId: string, token: string): void {
    this.server.to(`flow:${flowId}`).emit('execution:token', {
      executionId,
      podId,
      token,
    });
  }

  /**
   * Broadcast execution completion to flow
   */
  broadcastExecutionComplete(
    flowId: string,
    executionId: string,
    podId: string,
    result: any,
  ): void {
    this.server.to(`flow:${flowId}`).emit('execution:completed', {
      executionId,
      podId,
      status: 'COMPLETED',
      result,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast execution error to flow
   */
  broadcastExecutionError(flowId: string, executionId: string, podId: string, error: string): void {
    this.server.to(`flow:${flowId}`).emit('execution:error', {
      executionId,
      podId,
      status: 'ERROR',
      error,
      timestamp: new Date().toISOString(),
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

  /**
   * Rate limiting check
   */
  private checkRateLimit(client: Socket): boolean {
    const now = Date.now();
    const limit = this.rateLimitMap.get(client.id);

    if (!limit || now > limit.resetTime) {
      this.rateLimitMap.set(client.id, {
        count: 1,
        resetTime: now + this.RATE_LIMIT_WINDOW,
      });
      return true;
    }

    if (limit.count >= this.RATE_LIMIT) {
      client.emit('error', {
        message: 'Rate limit exceeded',
        code: 'RATE_LIMIT',
      });
      this.logger.warn(`Rate limit exceeded for client ${client.id}`);
      return false;
    }

    limit.count++;
    return true;
  }

  /**
   * Cleanup sessions older than 24 hours with no activity
   */
  private cleanupStaleSessions(): void {
    const now = Date.now();
    const staleThreshold = 24 * 60 * 60 * 1000; // 24 hours

    let cleaned = 0;

    for (const [flowId, sessions] of this.flowSessions.entries()) {
      for (const [socketId, session] of sessions.entries()) {
        if (now - session.joinedAt.getTime() > staleThreshold) {
          sessions.delete(socketId);
          cleaned++;
        }
      }

      if (sessions.size === 0) {
        this.flowSessions.delete(flowId);
      }
    }

    if (cleaned > 0) {
      this.logger.log(`🧹 Cleaned up ${cleaned} stale sessions`);
    }
  }

  /**
   * Get statistics for monitoring
   */
  getStats(): {
    activeFlows: number;
    totalSessions: number;
    averageUsersPerFlow: number;
  } {
    const activeFlows = this.flowSessions.size;
    let totalSessions = 0;

    for (const sessions of this.flowSessions.values()) {
      totalSessions += sessions.size;
    }

    return {
      activeFlows,
      totalSessions,
      averageUsersPerFlow: activeFlows > 0 ? totalSessions / activeFlows : 0,
    };
  }
}
