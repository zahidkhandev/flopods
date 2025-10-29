/**
 * File Size Limit Interceptor
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
 * Subscription tier file size limits (in bytes)
 */
const FILE_SIZE_LIMITS: Record<SubscriptionTier, number> = {
  [SubscriptionTier.HOBBYIST]: 10 * 1024 * 1024, // 10 MB ✅ (FREE PLAN)
  [SubscriptionTier.PRO]: 100 * 1024 * 1024, // 100 MB ✅ (PRO PLAN)
  [SubscriptionTier.TEAM]: 100 * 1024 * 1024, // 100 MB ✅ (TEAM PLAN - same as PRO)
};

/**
 * File size limit interceptor
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

    // Fetch workspace subscription tier
    const subscription = await this.prisma.subscription.findUnique({
      where: { workspaceId },
      select: { tier: true },
    });

    if (!subscription) {
      throw new BadRequestException('Workspace subscription not found');
    }

    // Get size limit for subscription tier
    const sizeLimit = FILE_SIZE_LIMITS[subscription.tier];

    // Check file size
    if (file.size > sizeLimit) {
      const limitMB = (sizeLimit / (1024 * 1024)).toFixed(0);
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);

      throw new PayloadTooLargeException(
        `File size (${fileSizeMB} MB) exceeds ${subscription.tier} plan limit of ${limitMB} MB. ` +
          `Upgrade to PRO plan for 100 MB limit.`,
      );
    }

    return next.handle();
  }
}
