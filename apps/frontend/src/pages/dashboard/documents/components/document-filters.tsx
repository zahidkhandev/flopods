// apps/frontend/src/pages/dashboard/documents/components/document-filters.tsx

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, AlertCircle, Loader2, X } from 'lucide-react';
import type { DocumentStatus } from '../types';
import { cn } from '@/lib/utils';

interface DocumentFiltersProps {
  statusCounts: Record<'ready' | 'processing' | 'queued' | 'failed', number>;
  activeStatus: DocumentStatus | null;
  onFilterChange: (status: DocumentStatus | null) => void;
}

export function DocumentFilters({
  statusCounts,
  activeStatus,
  onFilterChange,
}: DocumentFiltersProps) {
  const filters = [
    {
      status: 'READY' as DocumentStatus,
      label: 'Ready',
      count: statusCounts.ready,
      icon: CheckCircle2,
      color: 'text-green-600',
    },
    {
      status: 'PROCESSING' as DocumentStatus,
      label: 'Processing',
      count: statusCounts.processing,
      icon: Loader2,
      color: 'text-blue-600',
    },
    {
      status: 'QUEUED' as DocumentStatus,
      label: 'Queued',
      count: statusCounts.queued,
      icon: Clock,
      color: 'text-yellow-600',
    },
    {
      status: 'FAILED' as DocumentStatus,
      label: 'Failed',
      count: statusCounts.failed,
      icon: AlertCircle,
      color: 'text-red-600',
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-muted-foreground shrink-0 text-sm">Filter:</span>
      {filters.map((filter) => {
        const Icon = filter.icon;
        const isActive = activeStatus === filter.status;

        return (
          <Button
            key={filter.status}
            variant={isActive ? 'default' : 'outline'}
            size="sm"
            onClick={() => onFilterChange(isActive ? null : filter.status)}
            className="h-8 gap-2"
            disabled={filter.count === 0}
          >
            <Icon className={cn('h-3.5 w-3.5', !isActive && filter.color)} />
            <span className="text-xs">{filter.label}</span>
            <Badge variant={isActive ? 'secondary' : 'outline'} className="text-xs">
              {filter.count}
            </Badge>
          </Button>
        );
      })}
      {activeStatus && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onFilterChange(null)}
          className="h-8 gap-1"
        >
          <X className="h-3 w-3" />
          Clear
        </Button>
      )}
    </div>
  );
}
