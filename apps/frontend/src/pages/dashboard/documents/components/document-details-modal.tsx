import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  FileText,
  Database,
  FileStack,
  TrendingUp,
  Hash,
  AlertCircle,
  DollarSign,
  Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import type { Document } from '../types';

interface DocumentDetailsModalProps {
  document: Document | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DocumentDetailsModal({ document, open, onOpenChange }: DocumentDetailsModalProps) {
  if (!document) return null;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy h:mm a');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'READY':
        return 'bg-green-500';
      case 'PROCESSING':
        return 'bg-blue-500';
      case 'UPLOADING':
        return 'bg-yellow-500';
      case 'ERROR':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusVariant = (status: string) => {
    if (status === 'READY') return 'default';
    if (status === 'ERROR') return 'destructive';
    return 'secondary';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[90vh] max-h-[800px] w-[95vw] max-w-2xl p-0 sm:h-auto">
        <DialogHeader className="border-b px-4 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-blue-500 to-purple-600">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-foreground m-0 truncate text-lg">
                  {document.name}
                </DialogTitle>
                <div
                  className={`h-2 w-2 shrink-0 rounded-full ${getStatusColor(document.status)}`}
                />
                <Badge variant={getStatusVariant(document.status)} className="text-xs">
                  {document.status}
                </Badge>
              </div>
              <p className="text-muted-foreground text-xs">ID: {document.id}</p>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-120px)] max-h-[600px] sm:h-auto sm:max-h-[500px]">
          <div className="space-y-4 p-4 sm:space-y-6 sm:p-6">
            {/* Error Message */}
            {document.failureReason && (
              <div className="bg-destructive/10 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-destructive text-xs font-medium">Processing Failed</p>
                    <p className="text-destructive/80 mt-1 text-xs">{document.failureReason}</p>
                  </div>
                </div>
              </div>
            )}

            {/* File Information */}
            <div>
              <h3 className="text-foreground mb-3 text-sm font-semibold">File Information</h3>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="flex items-start gap-2">
                  <Database className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-muted-foreground text-xs">File Size</p>
                    <p className="text-foreground truncate text-sm font-medium">
                      {formatFileSize(document.sizeInBytes)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <FileText className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-muted-foreground text-xs">File Type</p>
                    <p className="text-foreground truncate text-sm font-medium">
                      {document.fileType}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Calendar className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-muted-foreground text-xs">Created</p>
                    <p className="text-foreground truncate text-sm font-medium">
                      {formatDate(document.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Calendar className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-muted-foreground text-xs">Updated</p>
                    <p className="text-foreground truncate text-sm font-medium">
                      {formatDate(document.updatedAt)}
                    </p>
                  </div>
                </div>

                {document.processing.processedAt && (
                  <div className="col-span-2 flex items-start gap-2">
                    <Calendar className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-muted-foreground text-xs">Processed</p>
                      <p className="text-foreground truncate text-sm font-medium">
                        {formatDate(document.processing.processedAt)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Processing Statistics */}
            <div>
              <h3 className="text-foreground mb-3 text-sm font-semibold">Processing Statistics</h3>
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                <div className="flex items-start gap-2">
                  <FileStack className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Chunks</p>
                    <p className="text-foreground text-xl font-bold sm:text-2xl">
                      {document.processing.chunks}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <TrendingUp className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Embeddings</p>
                    <p className="text-foreground text-xl font-bold sm:text-2xl">
                      {document.processing.embeddings}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Hash className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Tokens</p>
                    <p className="text-foreground text-xl font-bold sm:text-2xl">
                      {document.processing.tokens.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Cost Information */}
            {document.cost && (
              <>
                <Separator />
                <div>
                  <h3 className="text-foreground mb-3 text-sm font-semibold">Processing Cost</h3>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="flex items-start gap-2">
                      <DollarSign className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="text-muted-foreground text-xs">Total Cost</p>
                        <p className="text-foreground text-xl font-bold sm:text-2xl">
                          ${document.cost.totalUsd.toFixed(4)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Hash className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="text-muted-foreground text-xs">Credits Used</p>
                        <p className="text-foreground text-xl font-bold sm:text-2xl">
                          {document.cost.credits}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted/50 mt-3 space-y-1.5 rounded-lg p-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Extraction:</span>
                      <span className="text-foreground font-mono">
                        ${document.cost.breakdown.extraction.toFixed(6)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Embedding:</span>
                      <span className="text-foreground font-mono">
                        ${document.cost.breakdown.embedding.toFixed(6)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vision:</span>
                      <span className="text-foreground font-mono">
                        ${document.cost.breakdown.vision.toFixed(6)}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Tags */}
            {document.tags && document.tags.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="text-foreground mb-3 text-sm font-semibold">Tags</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {document.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
