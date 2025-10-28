import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';

export const PAGINATE_METADATA_KEY = 'paginate';

export interface PaginateOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
  search?: string;
  filters?: { [key: string]: any };
}

/**
 * This decorator is still available if you want to set some default metadata.
 */
export const Paginate = (
  options: PaginateOptions = {
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    order: 'desc',
  },
) => SetMetadata(PAGINATE_METADATA_KEY, options);

/**
 * Extract pagination options from the request query.
 */
export const PaginationParams = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): PaginateOptions => {
    const request = ctx.switchToHttp().getRequest();
    const page = parseInt(request.query.page, 10) || 1;
    const limit = parseInt(request.query.limit, 10) || 20;
    const sortBy = request.query.sortBy || 'createdAt';
    const order = request.query.order || 'desc';
    const search = request.query.search || '';
    const filters = request.query.filters ? JSON.parse(request.query.filters) : {};
    return { page, limit, sortBy, order, search, filters };
  },
);
