/**
 * Documents Page - PRODUCTION GRADE SUPER RESPONSIVE
 * Google Drive style with mobile-first design
 */

import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  RefreshCw,
  ArrowUp,
  FolderPlus,
  LayoutGrid,
  List,
  Search,
  Upload,
  FileText,
  Plus,
  Menu,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useDocuments, useUpload, useFolders } from './hooks';
import {
  DocumentDetailsModal,
  FolderBreadcrumb,
  FolderCard,
  DocumentCard,
  NewFolderModal,
  FolderContextMenu,
} from './components';
import type { Document } from './types';

export default function DocumentsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Folder management
  const {
    folders,
    currentFolderId,
    breadcrumb,
    navigateToFolder,
    navigateUp,
    canNavigateUp,
    createFolder,
    isCreatingFolder,
    isLoading: isFoldersLoading,
  } = useFolders();

  // Get folders in current directory
  const currentFolders = folders.filter((folder) => folder.parentId === currentFolderId);

  // Documents in current folder
  const {
    documents,
    isLoading: isDocumentsLoading,
    pagination,
    refetch,
  } = useDocuments({
    search: searchQuery || undefined,
    folderId: currentFolderId || undefined,
  });

  // Upload to current folder
  const { uploadFiles, activeUploads } = useUpload({
    folderId: currentFolderId || undefined,
    onSuccess: () => refetch(),
  });

  // Dropzone
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        uploadFiles(acceptedFiles, currentFolderId || undefined);
      }
    },
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
    maxSize: 100 * 1024 * 1024,
    multiple: true,
    noClick: true,
    noKeyboard: true,
  });

  const handleCreateFolder = async (name: string) => {
    await createFolder({
      name,
      parentId: currentFolderId || undefined,
    });
  };

  const handleViewDetails = (doc: Document) => {
    setSelectedDocument(doc);
    setShowDetailsModal(true);
  };

  const isLoading = isFoldersLoading || isDocumentsLoading;
  const isEmpty = currentFolders.length === 0 && documents.length === 0;

  return (
    <div className="space-y-4 pb-8 sm:space-y-6">
      {/* Header - Responsive */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Documents</h1>
          {/* Mobile Stats - Show under title on mobile */}
          <div className="text-muted-foreground mt-2 flex items-center gap-3 text-xs sm:hidden">
            <span>{currentFolders.length} folders</span>
            <span>•</span>
            <span>{pagination.totalItems} files</span>
            {activeUploads > 0 && (
              <>
                <span>•</span>
                <Badge variant="secondary" className="text-xs">
                  {activeUploads} uploading
                </Badge>
              </>
            )}
          </div>
        </div>

        {/* Desktop Actions */}
        <div className="hidden items-center gap-2 sm:flex">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          >
            {viewMode === 'grid' ? (
              <List className="h-4 w-4" />
            ) : (
              <LayoutGrid className="h-4 w-4" />
            )}
          </Button>
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
        </div>

        {/* Mobile Actions - Hamburger Menu */}
        <div className="flex items-center gap-2 sm:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="h-9"
          >
            {viewMode === 'grid' ? (
              <List className="h-4 w-4" />
            ) : (
              <LayoutGrid className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            className="h-9"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="h-9 gap-2">
                <Menu className="h-4 w-4" />
                <span className="xs:inline hidden">Menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setShowNewFolderModal(true)} className="gap-2">
                <FolderPlus className="h-4 w-4" />
                New Folder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={open} className="gap-2">
                <Upload className="h-4 w-4" />
                Upload Files
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Content Card */}
      <Card>
        {/* Toolbar */}
        <CardHeader className="space-y-3 sm:space-y-4">
          {/* Breadcrumb & Actions Row */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Breadcrumb with Back Button */}
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {canNavigateUp && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={navigateUp}
                  className="h-8 shrink-0 sm:h-9"
                >
                  <ArrowUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
              )}
              <div className="min-w-0 flex-1 overflow-hidden">
                <FolderBreadcrumb breadcrumb={breadcrumb} onNavigate={navigateToFolder} />
              </div>
            </div>

            {/* Desktop New Button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="hidden gap-2 sm:flex">
                  <Plus className="h-4 w-4" />
                  New
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => setShowNewFolderModal(true)} className="gap-2">
                  <FolderPlus className="h-4 w-4" />
                  New Folder
                </DropdownMenuItem>
                <DropdownMenuItem onClick={open} className="gap-2">
                  <Upload className="h-4 w-4" />
                  Upload Files
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Search Bar - Full Width */}
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 text-sm sm:h-10"
            />
          </div>

          {/* Desktop Stats */}
          <div className="text-muted-foreground hidden items-center gap-3 text-sm sm:flex sm:gap-4">
            <span>{currentFolders.length} folders</span>
            <span>•</span>
            <span>{pagination.totalItems} files</span>
            {activeUploads > 0 && (
              <>
                <span>•</span>
                <Badge variant="secondary">{activeUploads} uploading</Badge>
              </>
            )}
          </div>
        </CardHeader>

        {/* Content Area */}
        <CardContent className="p-3 sm:p-6">
          <FolderContextMenu
            onNewFolder={() => setShowNewFolderModal(true)}
            onUpload={open}
            onRefresh={refetch}
          >
            <div
              {...getRootProps()}
              className={cn(
                'relative min-h-[300px] rounded-lg border-2 border-dashed transition-all sm:min-h-[400px]',
                isDragActive
                  ? 'border-primary bg-primary/5'
                  : 'hover:border-muted border-transparent',
                isEmpty && !isLoading && 'border-muted'
              )}
            >
              <input {...getInputProps()} />

              {/* Drag Overlay */}
              {isDragActive && (
                <div className="bg-primary/10 absolute inset-0 z-50 flex items-center justify-center rounded-lg backdrop-blur-sm">
                  <div className="text-center">
                    <Upload className="text-primary mx-auto mb-3 h-12 w-12 sm:mb-4 sm:h-16 sm:w-16" />
                    <p className="text-primary text-lg font-semibold sm:text-2xl">
                      Drop files here
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm sm:mt-2">
                      Files will be uploaded to this folder
                    </p>
                  </div>
                </div>
              )}

              {/* Loading State */}
              {isLoading ? (
                <div className="grid gap-3 p-3 sm:grid-cols-2 sm:gap-4 sm:p-4 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 sm:h-24" />
                  ))}
                </div>
              ) : isEmpty && !searchQuery ? (
                /* Empty State */
                <div className="flex flex-col items-center justify-center px-4 py-12 sm:py-20">
                  <div className="text-muted-foreground mb-4 text-center sm:mb-6">
                    <div className="bg-muted mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full sm:mb-4 sm:h-20 sm:w-20">
                      <FolderPlus className="h-8 w-8 sm:h-10 sm:w-10" />
                    </div>
                    <h3 className="text-foreground mb-1 text-lg font-semibold sm:mb-2 sm:text-xl">
                      This folder is empty
                    </h3>
                    <p className="text-xs sm:text-sm">
                      Right-click or use the menu to create folders and upload files
                    </p>
                  </div>

                  <div className="flex flex-col items-center gap-2 sm:gap-3">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        variant="outline"
                        onClick={() => setShowNewFolderModal(true)}
                        className="gap-2 text-sm"
                        size="sm"
                      >
                        <FolderPlus className="h-4 w-4" />
                        New Folder
                      </Button>
                      <Button variant="default" onClick={open} className="gap-2 text-sm" size="sm">
                        <FileText className="h-4 w-4" />
                        Choose Files
                      </Button>
                    </div>
                    <p className="text-muted-foreground max-w-xs text-center text-xs">
                      Accepted: .pdf, .doc, .docx, .txt, .md, .png, .jpg • Max: 100 MB
                    </p>
                  </div>
                </div>
              ) : isEmpty && searchQuery ? (
                /* No Search Results */
                <div className="flex flex-col items-center justify-center py-12 sm:py-16">
                  <p className="text-muted-foreground text-sm sm:text-base">
                    No results found for &quot;{searchQuery}&quot;
                  </p>
                </div>
              ) : (
                /* Content Grid */
                <div className="space-y-4 p-3 sm:space-y-6 sm:p-4">
                  {/* Folders Section */}
                  {currentFolders.length > 0 && (
                    <div>
                      <h3 className="text-muted-foreground mb-2 text-xs font-medium sm:mb-3 sm:text-sm">
                        Folders
                      </h3>
                      <div
                        className={cn(
                          viewMode === 'grid'
                            ? 'grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3'
                            : 'space-y-2'
                        )}
                      >
                        {currentFolders.map((folder) => (
                          <FolderCard
                            key={folder.id}
                            folder={folder}
                            onClick={() => navigateToFolder(folder.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Documents Section */}
                  {documents.length > 0 && (
                    <div>
                      <h3 className="text-muted-foreground mb-2 text-xs font-medium sm:mb-3 sm:text-sm">
                        Files
                      </h3>
                      <div
                        className={cn(
                          viewMode === 'grid'
                            ? 'grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3'
                            : 'space-y-2'
                        )}
                      >
                        {documents.map((doc) => (
                          <DocumentCard
                            key={doc.id}
                            document={doc}
                            onViewDetails={handleViewDetails}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </FolderContextMenu>
        </CardContent>
      </Card>

      {/* Modals */}
      <NewFolderModal
        open={showNewFolderModal}
        onOpenChange={setShowNewFolderModal}
        onCreateFolder={handleCreateFolder}
        isCreating={isCreatingFolder}
      />

      <DocumentDetailsModal
        document={selectedDocument}
        open={showDetailsModal}
        onOpenChange={setShowDetailsModal}
      />
    </div>
  );
}
