import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class V1UserService {
  private readonly logger = new Logger(V1UserService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get user by ID with selected fields
   */
  async findById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(userId: string) {
    this.logger.log(`Fetching user data for: ${userId}`);
    return this.findById(userId);
  }

  /**
   * Get user with accounts (for checking email verification status)
   */
  async getUserWithAccounts(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        accounts: {
          select: {
            provider: true,
            providerAccountId: true,
            accessToken: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Check if user's email is verified
   */
  async checkEmailVerificationStatus(userId: string): Promise<{
    isVerified: boolean;
    email: string;
  }> {
    const user = await this.getUserWithAccounts(userId);

    // Find email account
    const emailAccount = user.accounts.find((acc) => acc.provider === 'EMAIL');

    // Email is verified if:
    // 1. No email account exists (OAuth user)
    // 2. Email account exists but accessToken is null (verified)
    const isVerified = !emailAccount || !emailAccount.accessToken;

    return {
      isVerified,
      email: user.email,
    };
  }
}
