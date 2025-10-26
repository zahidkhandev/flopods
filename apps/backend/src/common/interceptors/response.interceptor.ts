import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { PAGINATE_METADATA_KEY, PaginateOptions } from '../decorators/common';
import { Response } from 'express';

interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data: T | null;
  errors?: string[];
  timestamp: string;
  pagination?: {
    totalItems: number;
    totalPages: number;
    currentPage: number;
    pageSize: number;
  };
}

interface PaginationResult {
  data: any;
  pagination?: {
    totalItems: number;
    totalPages: number;
    currentPage: number;
    pageSize: number;
  };
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T> | any> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    // ✅ CRITICAL: Skip if headers already sent (streaming, OAuth redirects)
    if (response.headersSent) {
      return next.handle();
    }

    // ✅ CRITICAL: Check for SSE/streaming content type
    const contentType = response.getHeader('Content-Type');
    if (contentType && contentType.toString().includes('text/event-stream')) {
      return next.handle(); // Skip wrapping for SSE streams
    }

    const paginateOptions = this.reflector.get<PaginateOptions>(
      PAGINATE_METADATA_KEY,
      context.getHandler(),
    );

    return next.handle().pipe(
      map((data: any) => {
        // ✅ Double-check after handler execution
        if (response.headersSent) {
          return data;
        }

        // ✅ Check again for streaming content
        const updatedContentType = response.getHeader('Content-Type');
        if (updatedContentType && updatedContentType.toString().includes('text/event-stream')) {
          return data;
        }

        // Don't wrap null/undefined or redirects
        if (!data || response.statusCode === 302 || response.statusCode === 301) {
          return data;
        }

        const statusCode = data.statusCode || response.statusCode || HttpStatus.OK;
        const message = data.message || response.locals.customMessage || 'Success';
        const errors = data.errors || response.locals.errors || [];
        const timestamp = data.timestamp || new Date().toISOString();

        // If data already contains pagination metadata, return as-is
        if (data && typeof data === 'object' && data.pagination) {
          return this.sanitizeResponse({
            statusCode,
            message,
            data: data.data,
            errors,
            timestamp,
            pagination: data.pagination,
          });
        }

        // Apply pagination if needed
        const responseData = data.data !== undefined ? data.data : data;
        const paginationData: PaginationResult = {
          data: responseData,
        };

        if (Array.isArray(responseData) && paginateOptions) {
          const paginated = this.applyPagination(responseData, paginateOptions, request);
          paginationData.data = paginated.data;
          paginationData.pagination = paginated.pagination;
        }

        return this.sanitizeResponse({
          statusCode,
          message,
          data: paginationData.data as T,
          errors,
          timestamp,
          ...(paginationData.pagination ? { pagination: paginationData.pagination } : {}),
        });
      }),
    );
  }

  private applyPagination(data: any[], options: PaginateOptions, request: any): PaginationResult {
    let { page, limit, sortBy, order, search, filters } = options;
    page = parseInt(request.query.page, 10) || page || 1;
    limit = parseInt(request.query.limit, 10) || limit || 20;
    sortBy = request.query.sortBy || sortBy || 'createdAt';
    order = request.query.order || order || 'desc';
    search = request.query.search || search || '';
    filters = request.query.filters ? JSON.parse(request.query.filters) : filters || {};

    let filteredData = data;

    if (search) {
      filteredData = filteredData.filter((item) =>
        Object.values(item).some((val) => String(val).toLowerCase().includes(search.toLowerCase())),
      );
    }

    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        filteredData = filteredData.filter((item: { [key: string]: any }) => item[key] === value);
      }
    }

    if (sortBy) {
      filteredData = filteredData.sort((a, b) => {
        if (a[sortBy] < b[sortBy]) {
          return order === 'asc' ? -1 : 1;
        }
        if (a[sortBy] > b[sortBy]) {
          return order === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    const totalItems = filteredData.length;
    const totalPages = Math.ceil(totalItems / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = Math.min(startIndex + limit, totalItems);
    const paginatedData = filteredData.slice(startIndex, endIndex);

    return {
      data: paginatedData,
      pagination: {
        totalItems,
        totalPages,
        currentPage: page,
        pageSize: paginatedData.length,
      },
    };
  }

  private sanitizeData(data: any): any {
    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeData(item));
    } else if (data !== null && typeof data === 'object') {
      if (typeof data.toISOString === 'function') {
        return data.toISOString();
      }
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (key === 'hash' || key === 'password') {
          continue;
        }
        sanitized[key] = this.sanitizeData(value);
      }
      return sanitized;
    }
    return data;
  }

  private sanitizeResponse(response: ApiResponse<T>): ApiResponse<T> {
    return this.sanitizeData(response);
  }
}
