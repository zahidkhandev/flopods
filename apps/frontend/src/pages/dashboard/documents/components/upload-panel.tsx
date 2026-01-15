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
    <Card
      className={cn(
        'fixed right-4 bottom-4 z-50 shadow-2xl backdrop-blur-sm',
        'w-[calc(100vw-2rem)] sm:w-96 md:w-105 lg:w-110',
        'max-h-[85vh] sm:max-h-[75vh] md:max-h-150',
        'flex flex-col overflow-hidden',
        'border-border/80 bg-background/95 supports-backdrop-filter:bg-background/80'
      )}
    >
      {/* Header */}
      <div className="border-border/50 bg-background/95 shrink-0 border-b p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div
              className={cn(
                'h-2 w-2 shrink-0 rounded-full',
                activeCount > 0 ? 'animate-pulse bg-blue-500' : 'bg-muted'
              )}
            />
            <span className="text-foreground truncate text-sm font-medium">
              {activeCount > 0
                ? `Uploading ${activeCount}...`
                : `${uploads.length} upload${uploads.length === 1 ? '' : 's'}`}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {completedCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearCompleted}
                className="text-muted-foreground hover:text-foreground h-7 px-2.5 text-xs"
              >
                Clear
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onMinimize} className="h-7 w-7">
              <Minimize2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 p-3">
          {uploads.map((upload) => (
            <div
              key={upload.file.name}
              className={cn(
                'group relative overflow-hidden rounded-lg border p-3 transition-all',
                'hover:shadow-md',
                upload.status === 'success' &&
                  'border-green-200/50 bg-green-50/50 dark:border-green-800/50 dark:bg-green-950/30',
                upload.status === 'error' &&
                  'border-destructive/40 bg-destructive/5 dark:border-destructive/50 dark:bg-destructive/10',
                upload.status === 'uploading' &&
                  'border-blue-200/50 bg-blue-50/50 dark:border-blue-800/50 dark:bg-blue-950/30'
              )}
            >
              {/* File Info Row */}
              <div className="flex items-start gap-2.5 pr-7">
                {/* Status Icon */}
                <div className="bg-background/60 dark:bg-background/40 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                  {upload.status === 'uploading' && (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  )}
                  {upload.status === 'success' && (
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
                  )}
                  {upload.status === 'error' && (
                    <AlertCircle className="text-destructive h-4 w-4" />
                  )}
                </div>

                {/* File Details - Fixed overflow */}
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p
                    className="text-foreground/95 max-w-full truncate text-sm font-medium"
                    title={upload.file.name}
                  >
                    {upload.file.name}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {(upload.file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>

              {/* Progress/Status Section */}
              <div className="mt-2.5 space-y-2">
                {/* Progress Bar */}
                {upload.status === 'uploading' && (
                  <div className="space-y-1">
                    <Progress
                      value={upload.progress}
                      className="bg-muted/40 h-1.5 [&>div]:bg-linear-to-r [&>div]:from-blue-500 [&>div]:to-blue-600"
                    />
                    <p className="text-muted-foreground text-right text-xs">{upload.progress}%</p>
                  </div>
                )}

                {/* Error Message - Fixed overflow */}
                {upload.status === 'error' && upload.error && (
                  <div className="border-destructive/30 bg-destructive/10 dark:bg-destructive/20 flex flex-col items-start gap-2 rounded-md border p-2 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-start gap-2">
                      <AlertCircle className="text-destructive mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <p
                        className="text-destructive/90 line-clamp-2 max-w-full text-xs wrap-break-word"
                        title={upload.error}
                      >
                        {upload.error}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRetry(upload.file.name)}
                      className="border-destructive/50 hover:bg-destructive/20 h-7 w-full shrink-0 px-3 text-xs sm:w-auto"
                    >
                      Retry
                    </Button>
                  </div>
                )}

                {/* Success Badge */}
                {upload.status === 'success' && (
                  <div className="inline-flex items-center gap-1.5 rounded-md border border-green-200/60 bg-green-100/50 px-2.5 py-1 dark:border-green-800/60 dark:bg-green-900/30">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-500" />
                    <span className="text-xs font-medium text-green-700 dark:text-green-400">
                      Upload complete
                    </span>
                  </div>
                )}
              </div>

              {/* Remove Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemove(upload.file.name)}
                className={cn(
                  'absolute top-2 right-2 h-6 w-6 rounded-full',
                  'bg-background/80 hover:bg-destructive/90 hover:text-destructive-foreground',
                  'border-border/40 border shadow-sm',
                  'transition-all group-hover:shadow-md',
                  upload.status === 'uploading' && 'cursor-not-allowed opacity-40'
                )}
                disabled={upload.status === 'uploading'}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      {(completedCount > 0 || failedCount > 0) && (
        <div className="border-border/30 bg-muted/30 shrink-0 border-t p-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-3 text-xs">
              {completedCount > 0 && (
                <span className="flex items-center gap-1 font-medium text-green-600 dark:text-green-500">
                  <CheckCircle2 className="h-3 w-3" />
                  <span className="xs:inline hidden">{completedCount} completed</span>
                  <span className="xs:hidden">{completedCount}</span>
                </span>
              )}
              {failedCount > 0 && (
                <span className="text-destructive flex items-center gap-1 font-medium">
                  <AlertCircle className="h-3 w-3" />
                  <span className="xs:inline hidden">{failedCount} failed</span>
                  <span className="xs:hidden">{failedCount}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
