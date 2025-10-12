// src/common/decorators/user.decorator.ts

import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator, UnauthorizedException } from '@nestjs/common';

export const GetCurrentUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): number => {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;

    if (!userId) {
      throw new UnauthorizedException('User ID not found in request');
    }

    return parseInt(userId, 10);
  },
);
