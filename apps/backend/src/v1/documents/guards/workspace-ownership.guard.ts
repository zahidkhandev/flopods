/**
 * Workspace Ownership Guard
 */

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class V1WorkspaceOwnershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;
    const workspaceId = request.params?.workspaceId;

    if (!userId || !workspaceId) {
      throw new ForbiddenException('Missing user or workspace ID');
    }

    // Check if user is a member using WorkspaceUser (from your schema)
    const member = await this.prisma.workspaceUser.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You do not have access to this workspace');
    }

    // Attach workspace to request for later use
    request.workspace = { id: workspaceId, role: member.role };

    return true;
  }
}
