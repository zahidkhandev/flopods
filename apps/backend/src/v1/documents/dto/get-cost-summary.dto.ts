// /src/modules/v1/documents/dto/get-cost-summary.dto.ts

import { IsOptional, IsISO8601 } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetCostSummaryDto {
  @ApiPropertyOptional({
    description: 'Start date (ISO 8601)',
    example: '2025-10-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date (ISO 8601)',
    example: '2025-10-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsISO8601()
  endDate?: string;
}
