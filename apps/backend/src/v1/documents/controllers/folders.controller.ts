/**
 * Document Folders Controller
 *
 * @description Production-grade RESTful API for document folder management.
 * Provides tree-structured organization similar to Google Drive or Dropbox.
 * Supports nested folders with unlimited depth, bulk document operations,
 * circular reference prevention, and visual customization (icons, colors).
 *
 * **Key Features:**
 * - Tree-structured folder hierarchies (unlimited depth)
 * - Bulk document moves (100+ documents per request)
 * - Circular reference prevention for folder moves
 * - Visual customization (emoji icons, hex colors)
 * - Safe folder deletion (documents moved to root, preserved)
 * - Workspace isolation (security enforced at guard level)
 *
 * **Security:**
 * - All routes require JWT authentication (AccessTokenGuard)
 * - All routes validate workspace membership (WorkspaceOwnershipGuard)
 * - Guards prevent cross-workspace operations
 *
 * @module v1/documents/controllers/folders
 */

import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { V1WorkspaceOwnershipGuard } from '../guards/workspace-ownership.guard';
import { V1DocumentFoldersService } from '../services/folders.service';
import { CreateFolderDto, UpdateFolderDto, MoveItemsDto } from '../dto';
import { AccessTokenGuard } from '../../../common/guards/auth';
import { GetCurrentUserId } from '../../../common/decorators/user';
import type { DocumentFolder } from '@flopods/schema';

/**
 * Document folders controller
 *
 * @description Handles folder CRUD operations, tree structure management,
 * and bulk document operations. All routes enforce workspace isolation.
 *
 * **Route Prefix:** `/documents/folders`
 *
 * **Available Operations:**
 * - POST   /workspaces/:id                - Create folder
 * - GET    /workspaces/:id                - List folders (tree)
 * - GET    /workspaces/:id/:folderId      - Get folder details
 * - PATCH  /workspaces/:id/:folderId      - Update folder
 * - DELETE /workspaces/:id/:folderId      - Delete folder
 * - POST   /workspaces/:id/move           - Move documents
 */
@ApiTags('Document Folders')
@ApiBearerAuth()
@Controller('documents/folders')
@UseGuards(AccessTokenGuard)
export class V1DocumentFoldersController {
  constructor(private readonly foldersService: V1DocumentFoldersService) {}

  /**
   * Create folder
   *
   * @description Creates a new folder in workspace. Supports nested folder
   * creation by specifying parentId. Validates parent exists in same workspace.
   *
   * **Use Cases:**
   * - Organize documents by project, category, or team
   * - Create nested folder structures (Project → Subproject → Documents)
   * - Add visual identifiers for easy navigation (📁, 🏢, 📦)
   *
   * **Validation:**
   * - Name: 1-255 characters (enforced by DTO)
   * - Parent folder must exist in same workspace
   * - User must be workspace member (enforced by guard)
   *
   * **Visual Customization:**
   * - icon: Emoji or text identifier (e.g., "📁", "🏢", "Projects")
   * - color: Hex color code (e.g., "#3B82F6", "#10B981")
   *
   * @param workspaceId - Target workspace ID
   * @param userId - Authenticated user ID (from JWT)
   * @param dto - Folder creation data (name, parentId, icon, color)
   * @returns Created folder with all metadata
   *
   * @throws {UnauthorizedException} Invalid or expired JWT
   * @throws {ForbiddenException} User not workspace member
   * @throws {NotFoundException} Parent folder not found
   * @throws {BadRequestException} Invalid folder name
   *
   * @example
   * ```
   * POST /documents/folders/workspaces/ws_123
   * {
   *   "name": "Research Papers",
   *   "parentId": null,
   *   "icon": "📁",
   *   "color": "#3B82F6"
   * }
   * ```
   */
  @Post('workspaces/:workspaceId')
  @UseGuards(V1WorkspaceOwnershipGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create folder',
    description:
      'Create new folder in workspace. Supports nested folders by specifying parentId. ' +
      'Folder names should be descriptive and unique within parent for clarity. ' +
      'Optionally add emoji icon and hex color for visual organization.',
  })
  @ApiParam({
    name: 'workspaceId',
    description: 'Target workspace ID',
    example: 'cm3a1b2c3d4e5f6g7h8i9j0k',
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Folder created successfully',
    schema: {
      example: {
        id: 'cm3f1o2l3d4e5r',
        workspaceId: 'cm3a1b2c3d4e5f6g7h8i9j0k',
        name: 'Research Papers',
        parentId: null,
        icon: '📁',
        color: '#3B82F6',
        sortOrder: 0,
        createdBy: 'cm3u1s2e3r',
        createdAt: '2025-10-27T10:00:00Z',
        updatedAt: '2025-10-27T10:00:00Z',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid folder name (empty, too long, invalid characters)',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or expired JWT token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User not member of workspace',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Parent folder not found',
  })
  async createFolder(
    @Param('workspaceId') workspaceId: string,
    @GetCurrentUserId() userId: string,
    @Body() dto: CreateFolderDto,
  ): Promise<DocumentFolder> {
    return this.foldersService.createFolder(workspaceId, userId, dto.name, dto.parentId);
  }

  /**
   * List folders as tree
   *
   * @description Retrieves all folders in workspace organized as hierarchical tree.
   * Returns nested structure with children arrays for easy UI rendering (file explorer).
   *
   * **Tree Structure:**
   * - Root folders: No parent (parentId = null), at top level
   * - Children: Nested under parent folders in `children` array
   * - Unlimited depth: Supports deeply nested structures
   * - Sorted: By sortOrder (ascending), then createdAt
   *
   * **Performance:**
   * - O(n) algorithm where n = number of folders
   * - Efficient for large structures (1000+ folders)
   * - Single database query + in-memory tree building
   *
   * **UI Integration:**
   * Ideal for rendering folder trees with recursive components.
   * Each node contains full folder metadata + children array.
   *
   * @param workspaceId - Workspace ID
   * @returns Tree-structured array of root folders with nested children
   *
   * @example
   * ```
   * GET /documents/folders/workspaces/ws_123
   * // Returns:
   * [
   *   {
   *     id: 'f1', name: 'Projects', icon: '📁',
   *     children: [
   *       { id: 'f2', name: 'Client A', icon: '🏢', children: [] },
   *       { id: 'f3', name: 'Client B', icon: '🏢', children: [] }
   *     ]
   *   },
   *   { id: 'f4', name: 'Archive', icon: '📦', children: [] }
   * ]
   * ```
   */
  @Get('workspaces/:workspaceId')
  @UseGuards(V1WorkspaceOwnershipGuard)
  @ApiOperation({
    summary: 'List folders as tree',
    description:
      'Get all folders in workspace organized as tree structure. ' +
      'Returns nested hierarchy with children arrays for easy rendering. ' +
      'Root folders have parentId = null. Sorted by sortOrder and creation date. ' +
      'Ideal for file explorer UI components.',
  })
  @ApiParam({
    name: 'workspaceId',
    description: 'Workspace ID',
    example: 'cm3a1b2c3d4e5f6g7h8i9j0k',
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Folder tree retrieved successfully',
    schema: {
      example: [
        {
          id: 'cm3f1o2l3d4e5r',
          name: 'Projects',
          icon: '📁',
          color: '#3B82F6',
          children: [
            { id: 'cm3f2o2l3d4e5r', name: 'Client A', icon: '🏢', color: '#10B981', children: [] },
            { id: 'cm3f3o2l3d4e5r', name: 'Client B', icon: '🏢', color: '#F59E0B', children: [] },
          ],
        },
        { id: 'cm3f4o2l3d4e5r', name: 'Archive', icon: '📦', color: '#6B7280', children: [] },
      ],
    },
  })
  async listFolders(@Param('workspaceId') workspaceId: string): Promise<any> {
    return this.foldersService.listFolders(workspaceId);
  }

  /**
   * Get folder details
   *
   * @description Retrieves comprehensive information about specific folder including
   * metadata, parent reference, and statistics (document count, subfolder count).
   *
   * **Response Includes:**
   * - All folder metadata (name, icon, color, sortOrder)
   * - Parent folder reference (id + name, null if root)
   * - Document count in this folder
   * - Immediate subfolder count (not recursive)
   * - Created/updated timestamps
   *
   * **Use Cases:**
   * - Display folder properties dialog
   * - Show folder statistics in UI
   * - Breadcrumb navigation (via parent reference)
   *
   * @param workspaceId - Workspace ID (for validation)
   * @param folderId - Folder ID to retrieve
   * @returns Folder details with statistics
   *
   * @throws {NotFoundException} Folder not found
   *
   * @example
   * ```
   * GET /documents/folders/workspaces/ws_123/f_456
   * // Returns:
   * {
   *   id: 'f_456', name: 'Projects',
   *   parent: { id: 'f_123', name: 'Archive' },
   *   documentCount: 42, subfolderCount: 3
   * }
   * ```
   */
  @Get('workspaces/:workspaceId/:folderId')
  @UseGuards(V1WorkspaceOwnershipGuard)
  @ApiOperation({
    summary: 'Get folder details',
    description:
      'Retrieve detailed information about specific folder including ' +
      'metadata, parent reference, document count, and subfolder count.',
  })
  @ApiParam({ name: 'workspaceId', example: 'cm3a1b2c3d4e5f6g7h8i9j0k', type: String })
  @ApiParam({ name: 'folderId', example: 'cm3f1o2l3d4e5r', type: String })
  @ApiResponse({ status: HttpStatus.OK, description: 'Folder details with statistics' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Folder not found in workspace' })
  async getFolder(
    @Param('workspaceId') workspaceId: string,
    @Param('folderId') folderId: string,
  ): Promise<any> {
    return this.foldersService.getFolder(folderId, workspaceId);
  }

  /**
   * Update folder
   *
   * @description Updates folder metadata or moves folder to different parent.
   * Prevents circular references through parent chain validation.
   *
   * **Updatable Fields:**
   * - name: Rename folder (1-255 characters)
   * - icon: Change emoji/text identifier
   * - color: Update hex color code
   * - parentId: Move to different parent (or null for root)
   *
   * **Circular Reference Prevention:**
   * - Cannot move folder into itself (A → A)
   * - Cannot move folder into its descendants (A → A/B/C)
   * - Validates entire parent chain to prevent cycles
   *
   * **Validation:**
   * - New parent must exist in same workspace
   * - Cannot create circular references
   * - Name should be unique in target parent (recommended, not enforced)
   *
   * @param workspaceId - Workspace ID (for validation)
   * @param folderId - Folder ID to update
   * @param dto - Update data (name, icon, color, parentId)
   * @returns Updated folder with parent reference
   *
   * @throws {NotFoundException} Folder or parent not found
   * @throws {BadRequestException} Circular reference detected
   *
   * @example
   * ```
   * PATCH /documents/folders/workspaces/ws_123/f_456
   * { "parentId": "f_789", "icon": "📦" }
   * ```
   */
  @Patch('workspaces/:workspaceId/:folderId')
  @UseGuards(V1WorkspaceOwnershipGuard)
  @ApiOperation({
    summary: 'Update folder',
    description:
      'Update folder name, icon, color, or parent location. ' +
      'Set parentId to null to move folder to root. ' +
      'Prevents circular references and validates parent exists.',
  })
  @ApiParam({ name: 'workspaceId', example: 'cm3a1b2c3d4e5f6g7h8i9j0k', type: String })
  @ApiParam({ name: 'folderId', example: 'cm3f1o2l3d4e5r', type: String })
  @ApiResponse({ status: HttpStatus.OK, description: 'Folder updated successfully' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Circular reference or invalid parent',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Folder or parent not found' })
  async updateFolder(
    @Param('workspaceId') workspaceId: string,
    @Param('folderId') folderId: string,
    @Body() dto: UpdateFolderDto,
  ): Promise<any> {
    return this.foldersService.updateFolder(folderId, workspaceId, dto);
  }

  /**
   * Delete folder
   *
   * @description Permanently deletes folder. Documents are moved to root (preserved).
   * Subfolders are cascade deleted. This operation cannot be undone.
   *
   * **Deletion Behavior:**
   * - Folder record deleted from database
   * - Documents moved to root (folderId = null) - PRESERVED
   * - Subfolders recursively deleted (cascade via schema)
   * - Processing costs preserved (for audit trail)
   *
   * **Safety:**
   * Documents are never deleted, only moved to root. This prevents accidental
   * data loss. Users can manually delete documents if needed.
   *
   * **Performance:**
   * Efficient for folders with many documents (updates in single query).
   *
   * @param workspaceId - Workspace ID (for validation)
   * @param folderId - Folder ID to delete
   * @returns Success message
   *
   * @throws {NotFoundException} Folder not found
   *
   * @example
   * ```
   * DELETE /documents/folders/workspaces/ws_123/f_456
   * // Response: { message: 'Folder deleted successfully' }
   * ```
   */
  @Delete('workspaces/:workspaceId/:folderId')
  @UseGuards(V1WorkspaceOwnershipGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete folder',
    description:
      'Permanently delete folder. Documents are moved to root (preserved). ' +
      'Subfolders are recursively deleted. This action cannot be undone. ' +
      'Use with caution as subfolder deletion affects all nested folders.',
  })
  @ApiParam({ name: 'workspaceId', example: 'cm3a1b2c3d4e5f6g7h8i9j0k', type: String })
  @ApiParam({ name: 'folderId', example: 'cm3f1o2l3d4e5r', type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Folder deleted, documents moved to root',
    schema: { example: { message: 'Folder deleted successfully' } },
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Folder not found' })
  async deleteFolder(
    @Param('workspaceId') workspaceId: string,
    @Param('folderId') folderId: string,
  ): Promise<{ message: string }> {
    await this.foldersService.deleteFolder(folderId, workspaceId);
    return { message: 'Folder deleted successfully' };
  }

  /**
   * Move documents
   *
   * @description Bulk move multiple documents to different folder or root.
   * Efficient for reorganizing large numbers of documents (100+ per request).
   *
   * **Use Cases:**
   * - Drag & drop multiple documents in UI
   * - Move completed project files to archive
   * - Reorganize documents after folder restructuring
   * - Batch cleanup operations
   *
   * **Performance:**
   * - Single database query using updateMany
   * - Can handle 100+ documents efficiently
   * - No n+1 query issues
   *
   * **Security:**
   * Only moves documents within specified workspace. Cannot move documents
   * across workspaces (workspace ID validated).
   *
   * @param workspaceId - Workspace ID (for security validation)
   * @param dto - Document IDs array + destination folder ID
   * @returns Success message with count of moved documents
   *
   * @throws {NotFoundException} Destination folder not found
   * @throws {BadRequestException} Invalid document IDs
   *
   * @example
   * ```
   * POST /documents/folders/workspaces/ws_123/move
   * {
   *   "documentIds": ["doc_1", "doc_2", "doc_3"],
   *   "destinationFolderId": "f_456" // or null for root
   * }
   * // Response:
   * {
   *   "message": "3 documents moved successfully",
   *   "movedCount": 3
   * }
   * ```
   */
  @Post('workspaces/:workspaceId/move')
  @UseGuards(V1WorkspaceOwnershipGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Move documents',
    description:
      'Bulk move multiple documents to different folder or root. ' +
      'Set destinationFolderId to null to move to root (no folder). ' +
      'Efficient for batch operations (100+ documents). ' +
      'Only moves documents within workspace for security.',
  })
  @ApiParam({ name: 'workspaceId', example: 'cm3a1b2c3d4e5f6g7h8i9j0k', type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Documents moved successfully',
    schema: {
      example: {
        message: '5 documents moved successfully',
        movedCount: 5,
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid document IDs or empty array',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Destination folder not found',
  })
  async moveDocuments(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: MoveItemsDto,
  ): Promise<{ message: string; movedCount: number }> {
    const result = await this.foldersService.moveDocuments(
      workspaceId,
      dto.documentIds,
      dto.destinationFolderId,
    );

    return {
      message: `${result.movedCount} document${result.movedCount !== 1 ? 's' : ''} moved successfully`,
      movedCount: result.movedCount,
    };
  }
}
