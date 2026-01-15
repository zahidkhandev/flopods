// Re-export ALL generated client content (models, enums, client)
export * from './client';

// Re-export COMPLETE Prisma namespace (WhereInput, JsonNullValueInput, etc.)
import * as PrismaModule from '@prisma/client/runtime/public';
export * as Prisma from PrismaModule;

// Runtime Decimal
export { Decimal } from '@prisma/client/runtime/library';

// Ensure type compatibility
export type { PrismaPromise } from '@prisma/client/runtime/library';
