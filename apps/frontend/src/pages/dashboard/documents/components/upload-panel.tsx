import { CheckCircle2, AlertCircle, Loader2, Minimize2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { UploadProgress } from '../types';

interface UploadPanelProps {
  uploads: UploadProgress[];
  onRetry: (fileName: string) => void;
  onRemove: (fileName: string) => void;
  onClearCompleted: () => void;
  onMinimize: () => void;
}

export function UploadPanel({
  uploads,
  onRetry,
  onRemove,
  onClearCompleted,
  onMinimize,
}: UploadPanelProps) {
  if (uploads.length === 0) return null;

  const activeCount = uploads.filter((u) => u.status === 'uploading').length;
  const completedCount = uploads.filter((u) => u.status === 'success').length;
  const failedCount = uploads.filter((u) => u.status === 'error').length;

  return (
    <Card className="fixed right-4 bottom-4 z-50 w-96 max-w-[calc(100vw-2rem)] shadow-2xl">
      <div className="bg-muted/50 flex items-center justify-between border-b p-3">
        <div className="flex items-center gap-2">
          <Loader2 className={cn('h-4 w-4', activeCount > 0 && 'animate-spin')} />
          <div className="text-sm font-medium">
            {activeCount > 0 ? `Uploading ${activeCount} files` : 'Uploads'}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {completedCount > 0 && (
            <Button variant="ghost" size="sm" onClick={onClearCompleted} className="h-7 text-xs">
              Clear
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onMinimize} className="h-7 w-7">
            <Minimize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <ScrollArea className="max-h-96">
        <div className="space-y-2 p-2">
          {uploads.map((upload) => (
            <div
              key={upload.file.name}
              className={cn(
                'relative rounded-lg border p-3 transition-colors',
                upload.status === 'success' && 'border-green-200 bg-green-50',
                upload.status === 'error' && 'border-red-200 bg-red-50'
              )}
            >
              <div className="flex items-start gap-2 pr-6">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{upload.file.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {(upload.file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>

                {upload.status === 'uploading' && (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-600" />
                )}
                {upload.status === 'success' && (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                )}
                {upload.status === 'error' && (
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                )}
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemove(upload.file.name)}
                className="hover:bg-destructive/10 absolute top-1 right-1 h-6 w-6"
                disabled={upload.status === 'uploading'}
              >
                <X className="h-3 w-3" />
              </Button>

              {upload.status === 'uploading' && (
                <Progress value={upload.progress} className="mt-2 h-1.5" />
              )}

              {upload.status === 'error' && (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="flex-1 truncate text-xs text-red-600">{upload.error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRetry(upload.file.name)}
                    className="h-6 shrink-0 text-xs"
                  >
                    Retry
                  </Button>
                </div>
              )}

              {upload.status === 'success' && (
                <p className="mt-1 text-xs text-green-600">Upload complete</p>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {(completedCount > 0 || failedCount > 0) && (
        <div className="bg-muted/30 flex items-center justify-between border-t p-2 text-xs">
          <div className="flex items-center gap-3">
            {completedCount > 0 && (
              <span className="text-green-600">{completedCount} completed</span>
            )}
            {failedCount > 0 && <span className="text-red-600">{failedCount} failed</span>}
          </div>
        </div>
      )}
    </Card>
  );
}
