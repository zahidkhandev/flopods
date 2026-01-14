export enum FlowVisibility {
  PRIVATE = 'PRIVATE',
  WORKSPACE = 'WORKSPACE',
  PUBLIC = 'PUBLIC',
}

export interface Flow {
  id: string;
  workspaceId: string;
  spaceId: string | null;
  name: string;
  description: string | null;
  version: number;
  visibility: FlowVisibility;
  createdBy: string;
  thumbnailS3Key: string | null;
  thumbnailGeneratedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  podCount?: number;
  collaboratorCount?: number;
}

export interface FlowPagination {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export interface FlowsResponse {
  data: Flow[];
  pagination: FlowPagination;
}

// Backend response wrapper
export interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data: T;
  timestamp: string;
}
