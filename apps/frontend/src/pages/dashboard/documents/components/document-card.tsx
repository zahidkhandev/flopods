import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { DocumentActions } from './document-actions';
import { DocumentCostBadge } from './document-cost-badge';
import type { Document } from '../types';
import { cn } from '@/lib/utils';

interface DocumentCardProps {
  document: Document;
  onViewDetails: (doc: Document) => void;
  selected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export function DocumentCard({
  document: doc,
  onViewDetails,
  selected = false,
  onSelect,
  onDragStart,
  onDragEnd,
}: DocumentCardProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'READY':
        return <CheckCircle2 className="h-3.5 w-3.5 text-green-600 sm:h-4 sm:w-4" />;
      case 'PROCESSING':
        return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600 sm:h-4 sm:w-4" />;
      case 'UPLOADING':
        return <Clock className="h-3.5 w-3.5 text-yellow-600 sm:h-4 sm:w-4" />;
      case 'ERROR':
        return <XCircle className="h-3.5 w-3.5 text-red-600 sm:h-4 sm:w-4" />;
      default:
        return <FileText className="text-muted-foreground h-3.5 w-3.5 sm:h-4 sm:w-4" />;
    }
  };

  const handleCardClick = () => {
    if (onSelect) {
      onSelect(doc.id, !selected);
    }
  };

  return (
    <Card
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        'group hover:border-primary relative transition-all hover:shadow-md',
        selected && 'ring-primary border-primary bg-primary/5 ring-2',
        onSelect && 'cursor-pointer'
      )}
      onClick={onSelect ? handleCardClick : undefined}
    >
      {onSelect && (
        <div className="absolute top-2 left-2 z-10">
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelect(doc.id, !!checked)}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4"
          />
        </div>
      )}

      <div className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-blue-500 to-purple-600">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-foreground truncate text-sm font-semibold">{doc.name}</p>
              <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
                <span>{formatFileSize(doc.sizeInBytes)}</span>
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
                    : doc.status === 'ERROR'
                      ? 'destructive'
                      : 'secondary'
                }
                className="text-xs"
              >
                {doc.status}
              </Badge>
            </div>
            {doc.cost && doc.processing.tokens > 0 && (
              <DocumentCostBadge
                costUsd={doc.cost.totalUsd}
                credits={doc.cost.credits}
                tokensProcessed={doc.processing.tokens}
              />
            )}
            <DocumentActions document={doc} onViewDetails={onViewDetails} />
          </div>
        </div>

        <div className="hidden sm:flex sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-blue-500 to-purple-600">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-foreground truncate font-semibold">{doc.name}</p>
              <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
                <span>{formatFileSize(doc.sizeInBytes)}</span>
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
                  : doc.status === 'ERROR'
                    ? 'destructive'
                    : 'secondary'
              }
            >
              {doc.status}
            </Badge>
            {doc.cost && doc.processing.tokens > 0 && (
              <DocumentCostBadge
                costUsd={doc.cost.totalUsd}
                credits={doc.cost.credits}
                tokensProcessed={doc.processing.tokens}
              />
            )}
            <DocumentActions document={doc} onViewDetails={onViewDetails} />
          </div>
        </div>
      </div>
    </Card>
  );
}
