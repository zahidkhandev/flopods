// apps/frontend/src/pages/dashboard/documents/components/DocumentCostBadge.tsx

import { DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface DocumentCostBadgeProps {
  costUsd: number;
  credits: number;
  tokensProcessed: number;
}

export function DocumentCostBadge({ costUsd, credits, tokensProcessed }: DocumentCostBadgeProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="gap-1 text-xs">
          <DollarSign className="h-3 w-3" />
          {costUsd.toFixed(4)}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1 text-xs">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Cost:</span>
            <span className="font-mono">${costUsd.toFixed(6)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Credits:</span>
            <span className="font-mono">{credits}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Tokens:</span>
            <span className="font-mono">{tokensProcessed.toLocaleString()}</span>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
