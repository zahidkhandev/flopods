/**
 * Document Uploader with Drag & Drop
 * Enhanced upload experience with file validation
 */

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocumentUploaderProps {
  onFilesSelected: (files: File[]) => void;
  maxSize?: number; // in MB
  acceptedFileTypes?: string[];
  disabled?: boolean;
}

const DEFAULT_ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'image/png',
  'image/jpeg',
  'image/jpg',
];

const EXTENSIONS_MAP: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'text/plain': '.txt',
  'text/markdown': '.md',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
};

export function DocumentUploader({
  onFilesSelected,
  maxSize = 100, // 100 MB default
  acceptedFileTypes = DEFAULT_ACCEPTED_TYPES,
  disabled = false,
}: DocumentUploaderProps) {
  const maxSizeBytes = maxSize * 1024 * 1024;

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      if (acceptedFiles.length > 0) {
        onFilesSelected(acceptedFiles);
      }

      // Handle rejected files
      if (rejectedFiles.length > 0) {
        rejectedFiles.forEach((rejected) => {
          console.error('Rejected file:', rejected.file.name, rejected.errors);
        });
      }
    },
    [onFilesSelected]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject, fileRejections } = useDropzone({
    onDrop,
    accept: acceptedFileTypes.reduce(
      (acc, type) => {
        acc[type] = [EXTENSIONS_MAP[type] || ''];
        return acc;
      },
      {} as Record<string, string[]>
    ),
    maxSize: maxSizeBytes,
    disabled,
    multiple: true,
  });

  // Get accepted extensions for display
  const acceptedExtensions = acceptedFileTypes
    .map((type) => EXTENSIONS_MAP[type])
    .filter(Boolean)
    .join(', ');

  return (
    <Card
      {...getRootProps()}
      className={cn(
        'cursor-pointer border-2 border-dashed transition-all duration-200',
        isDragActive && !isDragReject && 'border-primary bg-primary/5',
        isDragReject && 'border-destructive bg-destructive/5',
        !isDragActive && 'hover:border-primary/50 hover:bg-accent/50',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <CardContent className="flex flex-col items-center justify-center py-10">
        <input {...getInputProps()} />

        {/* Upload Icon */}
        <div
          className={cn(
            'mb-4 flex h-16 w-16 items-center justify-center rounded-full transition-colors',
            isDragActive && !isDragReject && 'bg-primary/10',
            isDragReject && 'bg-destructive/10',
            !isDragActive && 'bg-muted'
          )}
        >
          {isDragReject ? (
            <X className="text-destructive h-8 w-8" />
          ) : isDragActive ? (
            <CheckCircle className="text-primary h-8 w-8" />
          ) : (
            <Upload className="text-muted-foreground h-8 w-8" />
          )}
        </div>

        {/* Text Content */}
        <div className="text-center">
          {isDragActive && !isDragReject ? (
            <p className="text-primary text-lg font-semibold">Drop files here to upload</p>
          ) : isDragReject ? (
            <p className="text-destructive text-lg font-semibold">Invalid file type or size</p>
          ) : (
            <>
              <p className="mb-2 text-lg font-semibold">Drag & drop files here</p>
              <p className="text-muted-foreground text-sm">or click to browse from your computer</p>
            </>
          )}

          <div className="mt-4 flex flex-col items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={disabled}>
              <FileText className="mr-2 h-4 w-4" />
              Choose Files
            </Button>

            <p className="text-muted-foreground text-xs">
              Accepted: {acceptedExtensions} • Max size: {maxSize} MB
            </p>
          </div>
        </div>

        {/* Error Messages */}
        {fileRejections.length > 0 && (
          <div className="bg-destructive/10 mt-4 w-full rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">
                <p className="text-destructive text-sm font-medium">Some files were rejected:</p>
                <ul className="text-destructive mt-1 list-inside list-disc text-xs">
                  {fileRejections.slice(0, 3).map((rejection) => (
                    <li key={rejection.file.name}>
                      {rejection.file.name}: {rejection.errors[0]?.message}
                    </li>
                  ))}
                  {fileRejections.length > 3 && <li>...and {fileRejections.length - 3} more</li>}
                </ul>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
