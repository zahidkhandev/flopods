// flow.gateway.ts
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

    client.to(`flow:${flowId}`).emit('user:joined', session);

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

  @SubscribeMessage('nodes:update')
  handleNodesUpdate(
    @MessageBody() data: { nodes: any[] },
    @ConnectedSocket() client: Socket,
  ): void {
    const flowId = client.data.flowId;
    if (!flowId) return;

    client.to(`flow:${flowId}`).emit('nodes:updated', {
      nodes: data.nodes,
      userId: client.data.userId,
      socketId: client.id,
    });
  }

  @SubscribeMessage('edges:update')
  handleEdgesUpdate(
    @MessageBody() data: { edges: any[] },
    @ConnectedSocket() client: Socket,
  ): void {
    const flowId = client.data.flowId;
    if (!flowId) return;

    client.to(`flow:${flowId}`).emit('edges:updated', {
      edges: data.edges,
      userId: client.data.userId,
      socketId: client.id,
    });
  }

  @SubscribeMessage('node:add')
  handleNodeAdd(@MessageBody() data: { node: any }, @ConnectedSocket() client: Socket): void {
    const flowId = client.data.flowId;
    if (!flowId) return;

    client.to(`flow:${flowId}`).emit('node:added', {
      node: data.node,
      userId: client.data.userId,
    });
  }

  @SubscribeMessage('node:delete')
  handleNodeDelete(
    @MessageBody() data: { nodeId: string },
    @ConnectedSocket() client: Socket,
  ): void {
    const flowId = client.data.flowId;
    if (!flowId) return;

    client.to(`flow:${flowId}`).emit('node:deleted', {
      nodeId: data.nodeId,
      userId: client.data.userId,
    });
  }

  @SubscribeMessage('edge:add')
  handleEdgeAdd(@MessageBody() data: { edge: any }, @ConnectedSocket() client: Socket): void {
    const flowId = client.data.flowId;
    if (!flowId) return;

    client.to(`flow:${flowId}`).emit('edge:added', {
      edge: data.edge,
      userId: client.data.userId,
    });
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
  }

  getFlowUserCount(flowId: string): number {
    return this.flowSessions.get(flowId)?.size || 0;
  }

  getActiveFlowsCount(): number {
    return this.flowSessions.size;
  }
}
