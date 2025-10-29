/**
 * Document Card - SUPER RESPONSIVE
 */

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { DocumentActions } from './document-actions';
import type { Document, DocumentStatus } from '../types';

interface DocumentCardProps {
  document: Document;
  onViewDetails: (doc: Document) => void;
}

export function DocumentCard({ document: doc, onViewDetails }: DocumentCardProps) {
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const getStatusIcon = (status: DocumentStatus) => {
    switch (status) {
      case 'READY':
        return <CheckCircle2 className="h-3.5 w-3.5 text-green-600 sm:h-4 sm:w-4" />;
      case 'PROCESSING':
        return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600 sm:h-4 sm:w-4" />;
      case 'QUEUED':
        return <Clock className="h-3.5 w-3.5 text-yellow-600 sm:h-4 sm:w-4" />;
      case 'FAILED':
        return <XCircle className="h-3.5 w-3.5 text-red-600 sm:h-4 sm:w-4" />;
      default:
        return <FileText className="h-3.5 w-3.5 text-gray-600 sm:h-4 sm:w-4" />;
    }
  };

  return (
    <Card className="group hover:border-primary transition-all hover:shadow-md">
      <div className="p-3 sm:p-4">
        {/* Mobile: Stacked Layout */}
        <div className="flex flex-col gap-3 sm:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{doc.name}</p>
              <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
                <span>{formatFileSize(doc.fileSize)}</span>
                <span>•</span>
                <span className="truncate">
                  {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {getStatusIcon(doc.status)}
              <Badge
                variant={
                  doc.status === 'READY'
                    ? 'default'
                    : doc.status === 'FAILED'
                      ? 'destructive'
                      : 'secondary'
                }
                className="text-xs"
              >
                {doc.status}
              </Badge>
            </div>
            <DocumentActions document={doc} onViewDetails={onViewDetails} />
          </div>
        </div>

        {/* Desktop: Horizontal Layout */}
        <div className="hidden sm:flex sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{doc.name}</p>
              <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
                <span>{formatFileSize(doc.fileSize)}</span>
                <span>•</span>
                <span>{formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}</span>
              </div>
            </div>
          </div>
          <div className="ml-4 flex shrink-0 items-center gap-2">
            {getStatusIcon(doc.status)}
            <Badge
              variant={
                doc.status === 'READY'
                  ? 'default'
                  : doc.status === 'FAILED'
                    ? 'destructive'
                    : 'secondary'
              }
            >
              {doc.status}
            </Badge>
            <DocumentActions document={doc} onViewDetails={onViewDetails} />
          </div>
        </div>
      </div>
    </Card>
  );
}
