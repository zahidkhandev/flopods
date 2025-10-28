/**
 * Document Access Guard
 *
 * @description Verifies user has access to specific document by checking workspace membership.
 * Used on document-specific routes (GET, PATCH, DELETE /documents/:documentId).
 *
 * @module v1/documents/guards/document-access
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Document access guard
 *
 * @description Validates that authenticated user has access to the requested document
 * by verifying they are a member of the document's workspace.
 *
 * **Checks:**
 * 1. Document exists
 * 2. User is member of document's workspace
 * 3. Workspace membership is active
 *
 * **Usage:**
 * ```
 * @UseGuards(AccessTokenGuard, DocumentAccessGuard)
 * @Get(':documentId')
 * async getDocument(@Param('documentId') documentId: string) {}
 * ```
 */
@Injectable()
export class V1DocumentAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate document access
   *
   * @param context - Execution context
   * @returns True if user has access, throws exception otherwise
   * @throws {NotFoundException} Document not found
   * @throws {ForbiddenException} User not member of document's workspace
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;
    const documentId = request.params?.documentId;

    if (!userId || !documentId) {
      throw new ForbiddenException('Missing user or document ID');
    }

    // Fetch document with workspace info
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        workspaceId: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Check if user is member of document's workspace
    const member = await this.prisma.workspaceUser.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId: document.workspaceId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You do not have access to this document');
    }

    // Attach document workspace to request for later use
    request.documentWorkspace = { id: document.workspaceId, role: member.role };

    return true;
  }
}
