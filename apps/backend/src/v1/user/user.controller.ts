import { Controller, Get, Logger } from '@nestjs/common';
import { V1UserService } from './user.service';
import { GetCurrentUserId } from '../../common/decorators/user';

@Controller('users')
export class V1UserController {
  private readonly logger = new Logger(V1UserController.name);

  constructor(private readonly userService: V1UserService) {}

  /**
   * GET /api/v1/users/me
   * Get current authenticated user
   */
  @Get('me')
  async getMe(@GetCurrentUserId('userId') userId: string) {
    this.logger.log(`User me endpoint called by: ${userId}`);

    const user = await this.userService.getCurrentUser(userId);

    return {
      statusCode: 200,
      message: 'User fetched successfully',
      data: {
        userId: user.id,
        email: user.email,
        name: user.firstName,
        image: user.image,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      errors: [],
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /api/v1/users/me/verification-status
   * Check email verification status
   */
  @Get('me/verification-status')
  async getVerificationStatus(@GetCurrentUserId('userId') userId: string) {
    this.logger.log(`Verification status check for: ${userId}`);

    const status = await this.userService.checkEmailVerificationStatus(userId);

    return {
      statusCode: 200,
      message: 'Verification status fetched successfully',
      data: status,
      errors: [],
      timestamp: new Date().toISOString(),
    };
  }
}
