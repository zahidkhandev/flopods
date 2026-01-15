import { Controller, Get, Logger } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { V1UserService } from './user.service';
import { GetCurrentUserId } from '../../common/decorators/user';
import { UserProfileResponseDto, VerificationStatusResponseDto } from './dto/user-response.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class V1UserController {
  private readonly logger = new Logger(V1UserController.name);

  constructor(private readonly userService: V1UserService) {}

  /**
   * GET /api/v1/users/me
   * Get current authenticated user
   */
  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile fetched successfully',
    type: UserProfileResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiOperation({ summary: 'Get current user email verification status' })
  @ApiResponse({
    status: 200,
    description: 'Verification status fetched successfully',
    type: VerificationStatusResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
