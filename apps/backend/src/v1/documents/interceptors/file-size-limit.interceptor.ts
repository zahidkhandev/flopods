// src/modules/v1/documents/interceptors/file-size-limit.interceptor.ts

/**
 * File Size Limit Interceptor
 *
 * @description Validates uploaded file size against subscription tier limits.
 * Prevents oversized uploads based on user's subscription plan.
 *
 * **Size Limits:**
 * - HOBBYIST (Free): 10 MB
 * - PRO: 100 MB
 * - TEAM: 100 MB
 *
 * @module v1/documents/interceptors/file-size-limit
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  PayloadTooLargeException,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { SubscriptionTier } from '@flopods/schema';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * ✅ Subscription tier file size limits (in bytes)
 */
const FILE_SIZE_LIMITS: Record<SubscriptionTier, number> = {
  [SubscriptionTier.HOBBYIST]: 10 * 1024 * 1024, // 10 MB (FREE)
  [SubscriptionTier.PRO]: 100 * 1024 * 1024, // 100 MB (PRO)
  [SubscriptionTier.TEAM]: 100 * 1024 * 1024, // 100 MB (TEAM)
};

/**
 * File size limit interceptor
 * Checks file size against subscription tier
 * Prevents uploads exceeding plan limits
 * Provides upgrade suggestions
 */
@Injectable()
export class V1FileSizeLimitInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const workspaceId = request.params?.workspaceId;
    const file = request.file as Express.Multer.File;

    if (!file) {
      return next.handle();
    }

    if (!workspaceId) {
      throw new BadRequestException('Workspace ID required for file upload');
    }

    // ✅ Fetch workspace subscription tier
    const subscription = await this.prisma.subscription.findUnique({
      where: { workspaceId },
      select: { tier: true },
    });

    if (!subscription) {
      throw new BadRequestException('Workspace subscription not found');
    }

    // ✅ Get size limit for subscription tier
    const sizeLimit = FILE_SIZE_LIMITS[subscription.tier];
    const limitMB = (sizeLimit / (1024 * 1024)).toFixed(0);
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);

    // ✅ Check file size
    if (file.size > sizeLimit) {
      throw new PayloadTooLargeException(
        `File size (${fileSizeMB} MB) exceeds ${subscription.tier} plan limit of ${limitMB} MB. ` +
          `Upgrade your subscription for higher limits.`,
      );
    }

    return next.handle();
  }
}
