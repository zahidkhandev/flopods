/**
 * Document Folders Service
 *
 * @description Production-grade service for managing document folder hierarchies.
 * Provides tree-structured organization similar to Google Drive or Dropbox.
 * Supports nested folders with unlimited depth, bulk document moves, circular
 * reference prevention, and folder customization (icons, colors).
 *
 * @module v1/documents/services/folders
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { DocumentFolder } from '@flopods/schema';

/**
 * Folder with children type
 */
interface FolderTreeNode extends DocumentFolder {
  children: FolderTreeNode[];
}

/**
 * Folder details response type
 */
interface FolderDetails {
  id: string;
  workspaceId: string;
  name: string;
  parentId: string | null;
  parent: { id: string; name: string } | null;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  documentCount: number;
  subfolderCount: number;
}

/**
 * Document folders service
 *
 * @description Handles folder CRUD operations, tree structure management,
 * and bulk document moves. Ensures data integrity with circular reference
 * prevention and workspace isolation.
 */
@Injectable()
export class V1DocumentFoldersService {
  private readonly logger = new Logger(V1DocumentFoldersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create folder
   *
   * @description Creates a new folder in workspace. Supports nested folders
   * by specifying parentId. Validates parent folder exists in same workspace.
   *
   * **Validation:**
   * - Parent folder must exist in same workspace
   * - Folder names should be unique within parent (not enforced at DB level)
   *
   * @param workspaceId - Target workspace ID
   * @param userId - User creating the folder (for audit trail)
   * @param name - Folder name (1-255 characters)
   * @param parentId - Optional parent folder ID for nesting
   * @returns Created folder with metadata
   *
   * @throws {NotFoundException} Parent folder not found
   *
   * @example
   * ```
   * const folder = await service.createFolder(
   *   'ws_123',
   *   'user_456',
   *   'Projects',
   *   null // Root folder
   * );
   * ```
   */
  async createFolder(
    workspaceId: string,
    userId: string,
    name: string,
    parentId?: string,
  ): Promise<DocumentFolder> {
    // Validate parent folder if specified
    if (parentId) {
      const parent = await this.prisma.documentFolder.findFirst({
        where: { id: parentId, workspaceId },
      });

      if (!parent) {
        throw new NotFoundException('Parent folder not found');
      }
    }

    // Create folder
    const folder = await this.prisma.documentFolder.create({
      data: {
        workspaceId,
        name,
        parentId: parentId || null,
        createdBy: userId,
      },
    });

    this.logger.log(`[Folders] Created folder: ${folder.id} in workspace: ${workspaceId}`);
    return folder;
  }

  /**
   * List folders as tree
   *
   * @description Retrieves all folders in workspace and organizes them into
   * a tree structure. Root folders (no parent) are at top level, children
   * are nested under parents. Supports unlimited depth.
   *
   * **Tree Building Algorithm:**
   * 1. Create map of all folders by ID
   * 2. Initialize children arrays for each folder
   * 3. Iterate folders and attach to parents or roots
   *
   * **Performance:** O(n) where n is number of folders. Efficient for large
   * folder structures (1000+ folders).
   *
   * @param workspaceId - Workspace ID
   * @returns Array of root folders with nested children
   *
   * @example
   * ```
   * const tree = await service.listFolders('ws_123');
   * // Returns:
   * // [
   * //   { id: '1', name: 'Projects', children: [
   * //     { id: '2', name: 'Client A', children: [] }
   * //   ]},
   * //   { id: '3', name: 'Archive', children: [] }
   * // ]
   * ```
   */
  async listFolders(workspaceId: string): Promise<FolderTreeNode[]> {
    const folders = await this.prisma.documentFolder.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
    });

    return this.buildFolderTree(folders);
  }

  /**
   * Get folder by ID
   *
   * @description Retrieves detailed information about a specific folder
   * including metadata, parent reference, and statistics (document count,
   * subfolder count).
   *
   * **Response Includes:**
   * - All folder metadata (name, icon, color, etc.)
   * - Parent folder reference (id + name)
   * - Document count in this folder
   * - Subfolder count (immediate children)
   *
   * @param folderId - Folder ID to retrieve
   * @param workspaceId - Workspace ID (for security/validation)
   * @returns Folder details with statistics
   *
   * @throws {NotFoundException} Folder not found
   *
   * @example
   * ```
   * const folder = await service.getFolder('folder_123', 'ws_456');
   * console.log(folder.documentCount); // 42
   * console.log(folder.subfolderCount); // 3
   * ```
   */
  async getFolder(folderId: string, workspaceId: string): Promise<FolderDetails> {
    const folder = await this.prisma.documentFolder.findFirst({
      where: {
        id: folderId,
        workspaceId,
      },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            documents: true,
            children: true,
          },
        },
      },
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    this.logger.debug(`[Folders] Retrieved folder: ${folderId}`);

    return {
      id: folder.id,
      workspaceId: folder.workspaceId,
      name: folder.name,
      parentId: folder.parentId,
      parent: folder.parent,
      icon: folder.icon,
      color: folder.color,
      sortOrder: folder.sortOrder,
      createdBy: folder.createdBy,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
      documentCount: folder._count.documents,
      subfolderCount: folder._count.children,
    };
  }

  /**
   * Update folder
   *
   * @description Updates folder metadata (name, icon, color) or moves folder
   * to different parent. Prevents circular references by validating parent chain.
   *
   * **Updatable Fields:**
   * - name: Rename folder
   * - icon: Change emoji/icon identifier (e.g., "📁", "🏢")
   * - color: Update visual color (hex code like "#3B82F6")
   * - parentId: Move to different parent (or null for root)
   *
   * **Validation:**
   * - Cannot move folder into itself (A → A)
   * - Cannot move folder into its own descendant (A → A/B)
   * - New parent must exist in same workspace
   *
   * **Circular Reference Prevention:**
   * Traverses parent chain from target parent up to root to detect cycles.
   *
   * @param folderId - Folder ID to update
   * @param workspaceId - Workspace ID (for security/validation)
   * @param updateData - Fields to update
   * @returns Updated folder with parent reference
   *
   * @throws {NotFoundException} Folder or parent not found
   * @throws {BadRequestException} Circular reference or invalid move
   *
   * @example
   * ```
   * // Move folder to different parent
   * await service.updateFolder('folder_123', 'ws_456', {
   *   parentId: 'parent_789',
   *   icon: '📦'
   * });
   * ```
   */
  async updateFolder(
    folderId: string,
    workspaceId: string,
    updateData: {
      name?: string;
      parentId?: string | null;
      icon?: string | null;
      color?: string | null;
    },
  ): Promise<DocumentFolder & { parent: { id: string; name: string } | null }> {
    // Verify folder exists
    const existingFolder = await this.prisma.documentFolder.findFirst({
      where: {
        id: folderId,
        workspaceId,
      },
    });

    if (!existingFolder) {
      throw new NotFoundException('Folder not found');
    }

    // If moving to new parent, validate it
    if (updateData.parentId !== undefined) {
      if (updateData.parentId) {
        // Cannot move folder into itself
        if (updateData.parentId === folderId) {
          throw new BadRequestException('Cannot move folder into itself');
        }

        // Check parent exists in same workspace
        const parent = await this.prisma.documentFolder.findFirst({
          where: {
            id: updateData.parentId,
            workspaceId,
          },
        });

        if (!parent) {
          throw new NotFoundException('Destination parent folder not found');
        }

        // Prevent circular reference (moving folder into its own descendant)
        const isCircular = await this.isCircularReference(folderId, updateData.parentId);
        if (isCircular) {
          throw new BadRequestException(
            'Cannot move folder into its own subfolder (circular reference)',
          );
        }
      }
    }

    // Update folder
    const updated = await this.prisma.documentFolder.update({
      where: { id: folderId },
      data: {
        ...(updateData.name && { name: updateData.name }),
        ...(updateData.parentId !== undefined && { parentId: updateData.parentId }),
        ...(updateData.icon !== undefined && { icon: updateData.icon }),
        ...(updateData.color !== undefined && { color: updateData.color }),
      },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    this.logger.log(`[Folders] Updated folder: ${folderId}`);
    return updated;
  }

  /**
   * Delete folder
   *
   * @description Permanently deletes folder. Documents in the folder are
   * moved to root (preserved for safety). Subfolders are cascade deleted
   * due to schema onDelete: Cascade.
   *
   * **Deletion Behavior:**
   * - Folder record deleted from database
   * - Documents moved to root (folderId = null)
   * - Subfolders recursively deleted (cascade)
   * - Cannot be undone
   *
   * **Safety:** Documents are never deleted, only moved to root. Users can
   * manually delete documents if needed.
   *
   * @param folderId - Folder ID to delete
   * @param workspaceId - Workspace ID (for security/validation)
   *
   * @throws {NotFoundException} Folder not found
   *
   * @example
   * ```
   * await service.deleteFolder('folder_123', 'ws_456');
   * // Folder deleted, documents moved to root
   * ```
   */
  async deleteFolder(folderId: string, workspaceId: string): Promise<void> {
    const folder = await this.prisma.documentFolder.findFirst({
      where: { id: folderId, workspaceId },
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    // Move documents to root (preserve them)
    await this.prisma.document.updateMany({
      where: { folderId },
      data: { folderId: null },
    });

    // Delete folder (subfolders cascade delete due to schema)
    await this.prisma.documentFolder.delete({
      where: { id: folderId },
    });

    this.logger.log(`[Folders] Deleted folder: ${folderId}`);
  }

  /**
   * Move documents to folder
   *
   * @description Bulk move multiple documents to a destination folder or root.
   * Efficient for reorganizing large numbers of documents. Validates destination
   * folder exists and only moves documents within workspace (security).
   *
   * **Use Cases:**
   * - Drag & drop multiple documents in UI
   * - Move completed project files to archive
   * - Reorganize after folder restructuring
   *
   * **Performance:** Single database query using updateMany for efficiency.
   * Can handle 100+ documents in one operation.
   *
   * **Security:** Only moves documents in specified workspace. Cannot move
   * documents across workspaces.
   *
   * @param workspaceId - Workspace ID (for security)
   * @param documentIds - Array of document IDs to move
   * @param destinationFolderId - Destination folder ID (or null for root)
   * @returns Object with count of moved documents
   *
   * @throws {NotFoundException} Destination folder not found
   *
   * @example
   * ```
   * const result = await service.moveDocuments(
   *   'ws_123',
   *   ['doc_1', 'doc_2', 'doc_3'],
   *   'folder_456'
   * );
   * console.log(result.movedCount); // 3
   * ```
   */
  async moveDocuments(
    workspaceId: string,
    documentIds: string[],
    destinationFolderId: string | null | undefined,
  ): Promise<{ movedCount: number }> {
    // Normalize undefined to null
    const normalizedFolderId = destinationFolderId === undefined ? null : destinationFolderId;

    // If destination folder specified, verify it exists
    if (normalizedFolderId) {
      const folder = await this.prisma.documentFolder.findFirst({
        where: {
          id: normalizedFolderId,
          workspaceId,
        },
      });

      if (!folder) {
        throw new NotFoundException('Destination folder not found');
      }
    }

    // Move documents
    const result = await this.prisma.document.updateMany({
      where: {
        id: { in: documentIds },
        workspaceId, // Security: only move documents in this workspace
      },
      data: {
        folderId: normalizedFolderId,
      },
    });

    this.logger.log(
      `[Folders] Moved ${result.count} documents to ${normalizedFolderId || 'root'} in workspace ${workspaceId}`,
    );

    return {
      movedCount: result.count,
    };
  }

  /**
   * Build folder tree from flat list
   *
   * @description Organizes flat array of folders into nested tree structure.
   * Uses Map for O(1) lookups and O(n) overall complexity.
   *
   * **Algorithm:**
   * 1. Create Map with all folders and empty children arrays
   * 2. Iterate folders and attach to parent or roots array
   * 3. Return roots array (folders with no parent)
   *
   * @param folders - Flat array of folders from database
   * @returns Tree-structured array with nested children
   *
   * @private
   */
  private buildFolderTree(folders: DocumentFolder[]): FolderTreeNode[] {
    const map = new Map<string, FolderTreeNode>();
    const roots: FolderTreeNode[] = [];

    // Create map with all folders and initialize children arrays
    folders.forEach((folderData) => {
      map.set(folderData.id, { ...folderData, children: [] });
    });

    // Attach folders to parents or roots
    folders.forEach((folderData) => {
      const folder = map.get(folderData.id)!;

      if (folderData.parentId) {
        const parent = map.get(folderData.parentId);
        if (parent) {
          parent.children.push(folder);
        }
      } else {
        roots.push(folder);
      }
    });

    return roots;
  }

  /**
   * Check if moving folder would create circular reference
   *
   * @description Traverses parent chain from target parent up to root.
   * If folder being moved is found in chain, circular reference detected.
   *
   * **Algorithm:**
   * 1. Start at target parent
   * 2. Follow parentId chain upwards
   * 3. If folderId found in chain → circular reference
   * 4. If reach root (no parent) → safe move
   *
   * **Performance:** O(d) where d is depth of folder hierarchy.
   * Typically < 10 iterations even for deep structures.
   *
   * @param folderId - Folder being moved
   * @param targetParentId - Destination parent
   * @returns True if circular reference would be created
   *
   * @private
   *
   * @example
   * ```
   * // Moving A into A/B/C would create cycle
   * const isCircular = await isCircularReference('A', 'C');
   * // Returns: true
   * ```
   */
  /**
   * Check if moving folder would create circular reference
   */
  private async isCircularReference(folderId: string, targetParentId: string): Promise<boolean> {
    let currentId: string | null = targetParentId;

    while (currentId) {
      if (currentId === folderId) {
        return true;
      }

      const currentFolder: { parentId: string | null } | null =
        await this.prisma.documentFolder.findUnique({
          where: { id: currentId },
          select: { parentId: true },
        });

      currentId = currentFolder?.parentId || null;
    }

    return false;
  }
}
