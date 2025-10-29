/**
 * Document Details Modal - SUPER RESPONSIVE
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  FileText,
  Calendar,
  Database,
  FileStack,
  TrendingUp,
  Hash,
  AlertCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Document } from '../types';

interface DocumentDetailsModalProps {
  document: Document | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DocumentDetailsModal({ document, open, onOpenChange }: DocumentDetailsModalProps) {
  if (!document) return null;

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'READY':
        return 'bg-green-500';
      case 'PROCESSING':
        return 'bg-blue-500';
      case 'QUEUED':
        return 'bg-yellow-500';
      case 'FAILED':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-2xl overflow-y-auto sm:w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 sm:gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 sm:h-10 sm:w-10">
              <FileText className="h-4 w-4 text-white sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base sm:text-lg">{document.name}</p>
            </div>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Detailed information about this document
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6">
          {/* Status Section */}
          <div>
            <h3 className="mb-2 text-sm font-semibold sm:mb-3">Status</h3>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${getStatusColor(document.status)}`} />
              <Badge
                variant={
                  document.status === 'READY'
                    ? 'default'
                    : document.status === 'FAILED'
                      ? 'destructive'
                      : 'secondary'
                }
                className="text-xs"
              >
                {document.status}
              </Badge>
              {document.status === 'PROCESSING' && (
                <span className="text-muted-foreground text-xs">Processing...</span>
              )}
            </div>
            {document.failureReason && (
              <div className="bg-destructive/10 mt-2 rounded-lg p-2 sm:mt-3 sm:p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="text-destructive mt-0.5 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                  <div className="min-w-0 flex-1">
                    <p className="text-destructive text-xs font-medium sm:text-sm">
                      Processing Failed
                    </p>
                    <p className="text-destructive/80 mt-1 text-xs break-words">
                      {document.failureReason}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* File Information */}
          <div>
            <h3 className="mb-2 text-sm font-semibold sm:mb-3">File Information</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <div className="flex items-start gap-2 sm:gap-3">
                <Database className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground text-xs">File Size</p>
                  <p className="truncate text-sm font-medium">
                    {formatFileSize(document.fileSize)}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 sm:gap-3">
                <FileText className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground text-xs">MIME Type</p>
                  <p className="truncate text-sm font-medium">{document.mimeType || 'N/A'}</p>
                </div>
              </div>

              <div className="flex items-start gap-2 sm:gap-3">
                <Hash className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground text-xs">Source Type</p>
                  <p className="truncate text-sm font-medium">{document.sourceType}</p>
                </div>
              </div>

              {document.externalUrl && (
                <div className="col-span-1 flex items-start gap-2 sm:col-span-2 sm:gap-3">
                  <FileText className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                  <div className="min-w-0 flex-1">
                    <p className="text-muted-foreground text-xs">External URL</p>
                    <p className="text-sm font-medium break-all">{document.externalUrl}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Processing Statistics */}
          <div>
            <h3 className="mb-2 text-sm font-semibold sm:mb-3">Processing Statistics</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              <div className="flex items-start gap-2 sm:gap-3">
                <FileStack className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                <div>
                  <p className="text-muted-foreground text-xs">Chunks</p>
                  <p className="text-xl font-bold sm:text-2xl">{document.chunkCount}</p>
                </div>
              </div>

              <div className="flex items-start gap-2 sm:gap-3">
                <TrendingUp className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                <div>
                  <p className="text-muted-foreground text-xs">Embeddings</p>
                  <p className="text-xl font-bold sm:text-2xl">{document.embeddingCount}</p>
                </div>
              </div>

              <div className="col-span-2 flex items-start gap-2 sm:col-span-1 sm:gap-3">
                <Hash className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                <div>
                  <p className="text-muted-foreground text-xs">Tokens</p>
                  <p className="text-xl font-bold sm:text-2xl">
                    {document.totalTokens.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Timeline */}
          <div>
            <h3 className="mb-2 text-sm font-semibold sm:mb-3">Timeline</h3>
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-start gap-2 sm:gap-3">
                <Calendar className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground text-xs">Created</p>
                  <p className="text-sm font-medium">{formatDate(document.createdAt)}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatDistanceToNow(new Date(document.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>

              {document.processedAt && (
                <div className="flex items-start gap-2 sm:gap-3">
                  <Calendar className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                  <div className="min-w-0 flex-1">
                    <p className="text-muted-foreground text-xs">Processed</p>
                    <p className="text-sm font-medium">{formatDate(document.processedAt)}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatDistanceToNow(new Date(document.processedAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2 sm:gap-3">
                <Calendar className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground text-xs">Last Updated</p>
                  <p className="text-sm font-medium">{formatDate(document.updatedAt)}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatDistanceToNow(new Date(document.updatedAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tags */}
          {document.tags && document.tags.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="mb-2 text-sm font-semibold sm:mb-3">Tags</h3>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {document.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* IDs */}
          <Separator />
          <div>
            <h3 className="mb-2 text-sm font-semibold sm:mb-3">Identifiers</h3>
            <div className="space-y-1.5 text-xs sm:space-y-2">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
                <span className="text-muted-foreground shrink-0">Document ID:</span>
                <code className="bg-muted px-1.1.5 rounded py-0.5 break-all">{document.id}</code>
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
                <span className="text-muted-foreground shrink-0">Workspace ID:</span>
                <code className="bg-muted px-1.5.5 rounded py-0.5 break-all">
                  {document.workspaceId}
                </code>
              </div>
              {document.s3Key && (
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">S3 Key:</span>
                  <code className="bg-muted py-0.0.5 rounded px-1.5 break-all">
                    {document.s3Key}
                  </code>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
