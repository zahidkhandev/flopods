import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useDocuments, useUpload, useFolders } from './hooks';
import { useDocumentKeyboardShortcuts } from './hooks/use-document-keyboard-shortcuts';
import {
  DocumentDetailsModal,
  FolderBreadcrumb,
  FolderCard,
  DocumentCard,
  NewFolderModal,
  FolderContextMenu,
  UploadPanel,
  BatchActions,
  MoveToFolderDialog,
} from './components';
import type { Document, DocumentStatus } from './types';

const STATUS_LABELS: Record<DocumentStatus, string> = {
  READY: 'Ready',
  PROCESSING: 'Processing',
  QUEUED: 'Queued',
  FAILED: 'Failed',
  PENDING: 'Pending',
};

const STATUS_ICONS: Record<DocumentStatus, React.ReactElement> = {
  READY: <CheckCircle2 className="mr-2 inline-block h-4 w-4 text-green-500" />,
  PROCESSING: <Clock className="mr-2 inline-block h-4 w-4 text-blue-400" />,
  QUEUED: <Clock className="mr-2 inline-block h-4 w-4 text-orange-400" />,
  FAILED: <XCircle className="mr-2 inline-block h-4 w-4 text-rose-500" />,
  PENDING: <Clock className="text-muted-foreground mr-2 inline-block h-4 w-4" />,
};

export default function DocumentsPage() {
  const { folderId } = useParams<{ folderId?: string }>();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showUploadPanel, setShowUploadPanel] = useState(true);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [activeStatusFilter, setActiveStatusFilter] = useState<DocumentStatus | null>(null);
  const [draggedDocument, setDraggedDocument] = useState<Document | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const {
    folders,
    breadcrumb,
    createFolder,
    folderTree,
    isCreatingFolder,
    refreshFolders,
    isLoading: isFoldersLoading,
  } = useFolders();

  const currentFolderId = folderId || null;
  const currentFolders = folders.filter((folder) => folder.parentId === currentFolderId);

  useDocumentKeyboardShortcuts({
    onUpload: () => open(),
    onNewFolder: () => setShowNewFolderModal(true),
    onRefresh: () => {
      refetch();
      refreshFolders();
    },
    onSearch: () => searchInputRef.current?.focus(),
  });

  const isGlobalSearch = searchQuery.trim().length > 0;

  const {
    documents,
    isLoading: isDocumentsLoading,
    pagination,
    refetch,
    deleteDocument,
    updateDocument,
  } = useDocuments({
    search: isGlobalSearch ? searchQuery : undefined,
    folderId: isGlobalSearch ? undefined : currentFolderId || undefined,
    status: activeStatusFilter || undefined,
    autoRefresh: !isGlobalSearch,
    refreshInterval: 5000,
  });

  const { uploadFiles, uploadQueue, retryUpload, removeFromQueue, clearCompleted, activeUploads } =
    useUpload({
      folderId: currentFolderId || undefined,
      onSuccess: () => {
        refetch();
        refreshFolders();
      },
    });

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        uploadFiles(acceptedFiles, currentFolderId || undefined);
        setShowUploadPanel(true);
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

  const navigateToFolder = (folderId: string | null) => {
    if (folderId) {
      navigate(`/dashboard/documents/folder/${folderId}`);
    } else {
      navigate('/dashboard/documents');
    }
  };

  const navigateUp = () => {
    if (!currentFolderId) return;
    const currentFolder = folders.find((f) => f.id === currentFolderId);
    if (currentFolder?.parentId) {
      navigate(`/dashboard/documents/folder/${currentFolder.parentId}`);
    } else {
      navigate('/dashboard/documents');
    }
  };

  const canNavigateUp = currentFolderId !== null;

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

  const handleSelectDocument = (documentId: string, selected: boolean) => {
    setSelectedDocuments((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(documentId);
      } else {
        next.delete(documentId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedDocuments.size === documents.length) {
      setSelectedDocuments(new Set());
    } else {
      setSelectedDocuments(new Set(documents.map((d) => d.id)));
    }
  };

  const handleBatchDelete = async () => {
    const confirmed = window.confirm(
      `Delete ${selectedDocuments.size} documents? This action cannot be undone.`
    );
    if (!confirmed) return;

    const promises = Array.from(selectedDocuments).map((id) => deleteDocument(id));
    await Promise.allSettled(promises);
    setSelectedDocuments(new Set());
    refetch();
    refreshFolders();
  };

  const handleBatchMoveToFolder = () => {
    setShowMoveDialog(true);
  };

  const handleMoveToFolder = async (targetFolderId: string | null) => {
    const promises = Array.from(selectedDocuments).map((id) =>
      updateDocument({ documentId: id, data: { folderId: targetFolderId } })
    );
    await Promise.allSettled(promises);
    setSelectedDocuments(new Set());
    setShowMoveDialog(false);
    refetch();
    refreshFolders();
  };

  const handleFolderDrop = async (targetFolderId: string | null) => {
    if (!draggedDocument) return;

    await updateDocument({ documentId: draggedDocument.id, data: { folderId: targetFolderId } });
    setDraggedDocument(null);
    refetch();
    refreshFolders();
  };

  const handleBatchDownload = () => {
    alert('Batch download coming soon!');
  };

  const handleDocumentDragStart = (doc: Document) => {
    setDraggedDocument(doc);
  };

  const handleDocumentDragEnd = () => {
    setDraggedDocument(null);
  };

  const isLoading = isFoldersLoading || isDocumentsLoading;
  const isEmpty = currentFolders.length === 0 && documents.length === 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardHeader className="space-y-1 sm:space-y-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
          </div>
          {/* Unified row: search, filters, right actions */}
          <div className="mt-0 flex w-full flex-row items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  ref={searchInputRef}
                  placeholder="Search documents... (Ctrl+K)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-9 text-sm sm:h-10"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-2 h-9 min-w-[110px] px-3 text-xs"
                  >
                    <span className="truncate">
                      {activeStatusFilter ? STATUS_ICONS[activeStatusFilter] : null}
                      {activeStatusFilter ? STATUS_LABELS[activeStatusFilter] : 'All Statuses'}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => setActiveStatusFilter(null)} className="gap-2">
                    <span>All Statuses</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setActiveStatusFilter('READY')}
                    className="gap-2"
                  >
                    {STATUS_ICONS.READY}
                    {STATUS_LABELS.READY}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setActiveStatusFilter('PROCESSING')}
                    className="gap-2"
                  >
                    {STATUS_ICONS.PROCESSING}
                    {STATUS_LABELS.PROCESSING}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setActiveStatusFilter('QUEUED')}
                    className="gap-2"
                  >
                    {STATUS_ICONS.QUEUED}
                    {STATUS_LABELS.QUEUED}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setActiveStatusFilter('FAILED')}
                    className="gap-2"
                  >
                    {STATUS_ICONS.FAILED}
                    {STATUS_LABELS.FAILED}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setActiveStatusFilter('PENDING')}
                    className="gap-2"
                  >
                    {STATUS_ICONS.PENDING}
                    {STATUS_LABELS.PENDING}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap">
              {documents.length > 0 && (
                <Button variant="outline" size="sm" onClick={handleSelectAll} className="gap-2">
                  {selectedDocuments.size === documents.length ? 'Deselect All' : 'Select All'}
                </Button>
              )}
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
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  refetch();
                  refreshFolders();
                }}
                disabled={isLoading}
              >
                <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">New</span>
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
          </div>
        </CardHeader>

        <CardContent className="">
          <FolderContextMenu
            onNewFolder={() => setShowNewFolderModal(true)}
            onUpload={open}
            onRefresh={() => {
              refetch();
              refreshFolders();
            }}
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

              {isLoading ? (
                <div className="grid gap-3 p-3 sm:grid-cols-2 sm:gap-4 sm:p-4 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 sm:h-24" />
                  ))}
                </div>
              ) : isEmpty && !searchQuery ? (
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
                    <p className="text-muted-foreground mt-2 text-xs">
                      Keyboard shortcuts:{' '}
                      <kbd className="bg-muted rounded px-1.5 py-0.5">Ctrl+U</kbd> Upload,{' '}
                      <kbd className="bg-muted rounded px-1.5 py-0.5">Ctrl+N</kbd> New Folder
                    </p>
                  </div>
                </div>
              ) : isEmpty && searchQuery ? (
                <div className="flex flex-col items-center justify-center py-12 sm:py-16">
                  <p className="text-muted-foreground text-sm sm:text-base">
                    No results found for &quot;{searchQuery}&quot;
                  </p>
                </div>
              ) : (
                <div className="space-y-4 p-3 sm:space-y-6 sm:p-4">
                  <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs sm:text-sm">
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
                    {selectedDocuments.size > 0 && (
                      <>
                        <span>•</span>
                        <Badge variant="default" className="text-xs">
                          {selectedDocuments.size} selected
                        </Badge>
                      </>
                    )}
                  </div>

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
                            onDrop={() => handleFolderDrop(folder.id)}
                            isDragTarget={!!draggedDocument}
                          />
                        ))}
                      </div>
                    </div>
                  )}

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
                            selected={selectedDocuments.has(doc.id)}
                            onSelect={handleSelectDocument}
                            onDragStart={() => handleDocumentDragStart(doc)}
                            onDragEnd={handleDocumentDragEnd}
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

      {showUploadPanel && (
        <UploadPanel
          uploads={uploadQueue}
          onRetry={(fileName) => retryUpload(fileName, currentFolderId || undefined)}
          onRemove={removeFromQueue}
          onClearCompleted={clearCompleted}
          onMinimize={() => setShowUploadPanel(false)}
        />
      )}

      <BatchActions
        selectedCount={selectedDocuments.size}
        onMoveToFolder={handleBatchMoveToFolder}
        onDelete={handleBatchDelete}
        onDownload={handleBatchDownload}
        onClearSelection={() => setSelectedDocuments(new Set())}
      />

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

      <MoveToFolderDialog
        open={showMoveDialog}
        onOpenChange={setShowMoveDialog}
        folders={folderTree}
        currentFolderId={currentFolderId}
        onMove={handleMoveToFolder}
      />
    </div>
  );
}
