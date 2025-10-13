import {
  Injectable,
  UnauthorizedException,
  Logger,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AwsSesEmailService } from '../../common/aws/ses/ses-email.service';
import { AuthUserType, GoogleUserData, GitHubUserData, JwtPayload } from './types';
import { AuthProvider } from '@actopod/schema';
import { randomBytes, createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import { magicLinkTemplate } from '../../common/aws/ses/templates/auth/magic-link.template';
import { resetPasswordTemplate } from '../../common/aws/ses/templates/auth/reset-password.template';
import { verifyEmailTemplate } from '../../common/aws/ses/templates/auth/verify-email.template';
import { welcomeEmailTemplate } from '../../common/aws/ses/templates/auth/welcome.template';

@Injectable()
export class V1AuthService {
  private readonly logger = new Logger(V1AuthService.name);
  private readonly MAGIC_LINK_EXPIRY = 15 * 60 * 1000;
  private readonly RESET_PASSWORD_EXPIRY = 60 * 60 * 1000;
  private readonly MAX_ATTEMPTS = 3;
  private readonly ATTEMPT_WINDOW = 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: AwsSesEmailService,
  ) {}

  // ============================================
  // PASSWORD AUTHENTICATION
  // ============================================

  async register(
    email: string,
    name: string,
    password: string,
  ): Promise<{ message: string; userId: string }> {
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hash = await bcrypt.hash(password, 10);
    const verificationToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(verificationToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: { email: normalizedEmail, name, hash },
      });

      await tx.account.create({
        data: {
          userId: newUser.id,
          provider: AuthProvider.EMAIL,
          providerAccountId: normalizedEmail,
          accessToken: tokenHash,
          expiresAt,
        },
      });

      await tx.workspace.create({
        data: {
          name: `${name}'s Workspace`,
          type: 'PERSONAL',
          members: {
            create: {
              userId: newUser.id,
              role: 'OWNER',
              canCreateCanvas: true,
              canDeleteCanvas: true,
              canManageBilling: true,
              canInviteMembers: true,
              canManageMembers: true,
              canManageApiKeys: true,
            },
          },
        },
      });

      return newUser;
    });

    const verificationUrl = `${this.configService.get('FRONTEND_URL')}/auth/verify-email?token=${verificationToken}`;
    await this.emailService.sendEmail({
      to: user.email,
      subject: 'Verify your Actopod account',
      bodyHtml: verifyEmailTemplate(user.name || 'there', verificationUrl),
    });

    this.logger.log(`User registered: ${user.email}`);

    return {
      message: 'Registration successful. Please check your email to verify your account.',
      userId: user.id,
    };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const account = await this.prisma.account.findFirst({
      where: {
        accessToken: tokenHash,
        provider: AuthProvider.EMAIL,
        expiresAt: { gte: new Date() },
      },
      include: { user: true },
    });

    if (!account) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.account.update({
      where: { id: account.id },
      data: { accessToken: null, expiresAt: null },
    });

    await this.emailService.sendEmail({
      to: account.user.email,
      subject: 'Welcome to Actopod!',
      bodyHtml: welcomeEmailTemplate(account.user.name || 'there'),
    });

    this.logger.log(`Email verified: ${account.user.email}`);
    return { message: 'Email verified successfully. You can now log in.' };
  }

  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { accounts: { where: { provider: AuthProvider.EMAIL } } },
    });

    if (!user) {
      this.logger.warn(`Verification resend requested for non-existent user: ${normalizedEmail}`);
      return {
        message: 'If the email exists and is not verified, a verification link has been sent',
      };
    }

    const emailAccount = user.accounts[0];
    if (emailAccount && !emailAccount.accessToken) {
      return { message: 'Email is already verified' };
    }

    if (emailAccount?.expiresAt && emailAccount.expiresAt > new Date()) {
      const timeSinceLastSent = Date.now() - emailAccount.createdAt.getTime();
      if (timeSinceLastSent < 60 * 1000) {
        throw new BadRequestException('Please wait before requesting another verification email');
      }
    }

    const verificationToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(verificationToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.prisma.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: AuthProvider.EMAIL,
          providerAccountId: normalizedEmail,
        },
      },
      create: {
        userId: user.id,
        provider: AuthProvider.EMAIL,
        providerAccountId: normalizedEmail,
        accessToken: tokenHash,
        expiresAt,
      },
      update: { accessToken: tokenHash, expiresAt },
    });

    const verificationUrl = `${this.configService.get('FRONTEND_URL')}/auth/verify-email?token=${verificationToken}`;
    await this.emailService.sendEmail({
      to: user.email,
      subject: 'Verify your Actopod account',
      bodyHtml: verifyEmailTemplate(user.name || 'there', verificationUrl),
    });

    this.logger.log(`Verification email resent to: ${user.email}`);
    return {
      message: 'If the email exists and is not verified, a verification link has been sent',
    };
  }

  async checkEmailVerifiedStatus(userId: string): Promise<{ isVerified: boolean; email: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { accounts: { where: { provider: AuthProvider.EMAIL } } },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const emailAccount = user.accounts[0];
    const isVerified = !emailAccount || !emailAccount.accessToken;

    return { isVerified, email: user.email };
  }

  async login(email: string, password: string, deviceName: string): Promise<AuthUserType> {
    const normalizedEmail = email.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.hash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user already has a token for this device
    const existingToken = await this.prisma.refreshToken.findFirst({
      where: { userId: user.id, deviceName: deviceName },
    });

    this.logger.log(`User logged in: ${user.email}`);

    return this.generateTokens(user.id, user.email, deviceName, existingToken?.id);
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.hash) {
      return { message: 'If the email exists, a password reset link has been sent' };
    }

    const resetToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + this.RESET_PASSWORD_EXPIRY);

    await this.prisma.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: AuthProvider.EMAIL,
          providerAccountId: normalizedEmail,
        },
      },
      create: {
        userId: user.id,
        provider: AuthProvider.EMAIL,
        providerAccountId: normalizedEmail,
        refreshToken: tokenHash,
        expiresAt,
      },
      update: { refreshToken: tokenHash, expiresAt },
    });

    const resetUrl = `${this.configService.get('FRONTEND_URL')}/auth/reset-password?token=${resetToken}`;
    await this.emailService.sendEmail({
      to: user.email,
      subject: 'Reset your Actopod password',
      bodyHtml: resetPasswordTemplate(user.name || 'there', resetUrl),
    });

    this.logger.log(`Password reset requested: ${user.email}`);
    return { message: 'If the email exists, a password reset link has been sent' };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const account = await this.prisma.account.findFirst({
      where: {
        refreshToken: tokenHash,
        provider: AuthProvider.EMAIL,
        expiresAt: { gte: new Date() },
      },
      include: { user: true },
    });

    if (!account) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hash = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: account.userId },
        data: { hash },
      }),
      this.prisma.account.update({
        where: { id: account.id },
        data: { refreshToken: null, expiresAt: null },
      }),
      this.prisma.refreshToken.deleteMany({
        where: { userId: account.userId },
      }),
    ]);

    this.logger.log(`Password reset: ${account.user.email}`);
    return { message: 'Password reset successfully. You can now log in with your new password.' };
  }

  // ============================================
  // MAGIC LINK AUTHENTICATION
  // ============================================

  async sendMagicLink(
    email: string,
    deviceName: string,
    ipAddress: string,
  ): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase().trim();

    const recentAttempts = await this.prisma.account.count({
      where: {
        user: { email: normalizedEmail },
        provider: AuthProvider.EMAIL,
        createdAt: { gte: new Date(Date.now() - this.ATTEMPT_WINDOW) },
      },
    });

    if (recentAttempts >= this.MAX_ATTEMPTS) {
      throw new BadRequestException('Too many login attempts. Please try again in 1 hour.');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      this.logger.warn(`Magic link requested for non-existent user: ${normalizedEmail}`);
      return { message: 'If the email exists, a magic link has been sent' };
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + this.MAGIC_LINK_EXPIRY);

    await this.prisma.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: AuthProvider.EMAIL,
          providerAccountId: normalizedEmail,
        },
      },
      create: {
        userId: user.id,
        provider: AuthProvider.EMAIL,
        providerAccountId: normalizedEmail,
        accessToken: tokenHash,
        refreshToken: JSON.stringify({ deviceName, ipAddress }),
        expiresAt,
      },
      update: {
        accessToken: tokenHash,
        refreshToken: JSON.stringify({ deviceName, ipAddress }),
        expiresAt,
      },
    });

    const magicUrl = `${this.configService.get('FRONTEND_URL')}/auth/verify-magic-link?token=${token}&email=${encodeURIComponent(normalizedEmail)}`;

    await this.emailService.sendEmail({
      to: user.email,
      subject: '🔐 Sign in to Actopod',
      bodyHtml: magicLinkTemplate(
        user.name || 'there',
        magicUrl,
        '15 minutes',
        ipAddress,
        deviceName,
      ),
    });

    this.logger.log(`Magic link sent to: ${normalizedEmail}`);
    return { message: 'If the email exists, a magic link has been sent' };
  }

  async verifyMagicLink(
    token: string,
    email: string,
    deviceName: string,
    _ipAddress: string,
  ): Promise<AuthUserType> {
    const normalizedEmail = email.toLowerCase().trim();
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const account = await this.prisma.account.findFirst({
      where: {
        provider: AuthProvider.EMAIL,
        providerAccountId: normalizedEmail,
        accessToken: tokenHash,
        expiresAt: { gte: new Date() },
      },
      include: { user: true },
    });

    if (!account) {
      this.logger.warn(`Invalid or expired magic link: ${normalizedEmail}`);
      throw new UnauthorizedException('Invalid or expired magic link');
    }

    try {
      const metadata = JSON.parse(account.refreshToken || '{}');
      if (metadata.ipAddress !== _ipAddress) {
        this.logger.warn(`IP mismatch for magic link: ${normalizedEmail}`);
      }
    } catch {
      /* empty */
    }

    await this.prisma.account.update({
      where: { id: account.id },
      data: { accessToken: null, refreshToken: null, expiresAt: null },
    });

    this.logger.log(`Magic link verified: ${normalizedEmail}`);

    // Check for existing device
    const existingToken = await this.prisma.refreshToken.findFirst({
      where: { userId: account.user.id, deviceName: deviceName },
    });

    return this.generateTokens(account.user.id, account.user.email, deviceName, existingToken?.id);
  }

  // ============================================
  // OAUTH AUTHENTICATION
  // ============================================

  async validateGoogleUser(data: GoogleUserData): Promise<AuthUserType> {
    const { email, firstName, lastName, googleId, picture, deviceName } = data;

    let user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      user = await this.prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email: email.toLowerCase(),
            name: `${firstName} ${lastName}`.trim(),
            image: picture,
            hash: null,
          },
        });

        await tx.workspace.create({
          data: {
            name: `${newUser.name}'s Workspace`,
            type: 'PERSONAL',
            members: {
              create: {
                userId: newUser.id,
                role: 'OWNER',
                canCreateCanvas: true,
                canDeleteCanvas: true,
                canManageBilling: true,
                canInviteMembers: true,
                canManageMembers: true,
                canManageApiKeys: true,
              },
            },
          },
        });

        this.logger.log(`New user created via Google: ${newUser.email}`);
        return newUser;
      });
    }

    await this.prisma.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: AuthProvider.GOOGLE,
          providerAccountId: googleId,
        },
      },
      create: {
        userId: user.id,
        provider: AuthProvider.GOOGLE,
        providerAccountId: googleId,
      },
      update: {},
    });

    const existingToken = await this.prisma.refreshToken.findFirst({
      where: { userId: user.id, deviceName: deviceName },
    });

    return this.generateTokens(user.id, user.email, deviceName, existingToken?.id);
  }

  async validateGitHubUser(data: GitHubUserData): Promise<AuthUserType> {
    const { email, name, githubId, avatarUrl, deviceName } = data;

    let user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      user = await this.prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email: email.toLowerCase(),
            name,
            image: avatarUrl,
            hash: null,
          },
        });

        await tx.workspace.create({
          data: {
            name: `${newUser.name}'s Workspace`,
            type: 'PERSONAL',
            members: {
              create: {
                userId: newUser.id,
                role: 'OWNER',
                canCreateCanvas: true,
                canDeleteCanvas: true,
                canManageBilling: true,
                canInviteMembers: true,
                canManageMembers: true,
                canManageApiKeys: true,
              },
            },
          },
        });

        this.logger.log(`New user created via GitHub: ${newUser.email}`);
        return newUser;
      });
    }

    await this.prisma.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: AuthProvider.GITHUB,
          providerAccountId: githubId,
        },
      },
      create: {
        userId: user.id,
        provider: AuthProvider.GITHUB,
        providerAccountId: githubId,
      },
      update: {},
    });

    const existingToken = await this.prisma.refreshToken.findFirst({
      where: { userId: user.id, deviceName: deviceName },
    });

    return this.generateTokens(user.id, user.email, deviceName, existingToken?.id);
  }

  // ============================================
  // TOKEN MANAGEMENT
  // ============================================

  async refreshTokens(refreshToken: string, deviceId: string): Promise<AuthUserType> {
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken || storedToken.expiresAt < new Date() || storedToken.id !== deviceId) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const deviceName = storedToken.deviceName;

    return this.generateTokens(storedToken.user.id, storedToken.user.email, deviceName, deviceId);
  }

  async logout(userId: string, deviceId: string): Promise<{ message: string }> {
    await this.prisma.refreshToken.deleteMany({
      where: { userId, id: deviceId },
    });

    this.logger.log(`User logged out: ${userId} from device: ${deviceId}`);
    return { message: 'Logged out successfully' };
  }

  async logoutAllDevices(userId: string): Promise<{ message: string }> {
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });

    this.logger.log(`User logged out from all devices: ${userId}`);
    return { message: 'Logged out from all devices' };
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private async generateTokens(
    userId: string,
    email: string,
    deviceName: string,
    existingTokenId?: string,
  ): Promise<AuthUserType> {
    const payload: JwtPayload = { userId, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_ACCESS_TOKEN_SECRET'),
        expiresIn: this.configService.get('JWT_ACCESS_TOKEN_EXPIRATION'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_REFRESH_TOKEN_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_TOKEN_EXPIRATION'),
      }),
    ]);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    let tokenRecord;

    if (existingTokenId) {
      // UPDATE existing record (keeps same ID)
      tokenRecord = await this.prisma.refreshToken.update({
        where: { id: existingTokenId },
        data: {
          token: refreshToken,
          expiresAt,
          deviceName: deviceName,
        },
      });
    } else {
      // CREATE new record
      tokenRecord = await this.prisma.refreshToken.create({
        data: {
          userId,
          deviceName: deviceName, // Store deviceName in deviceId column
          token: refreshToken,
          expiresAt,
        },
      });
    }

    return {
      userId,
      email,
      accessToken,
      refreshToken,
      deviceId: tokenRecord.id, // Database CUID
      deviceName: deviceName, // Human-readable name
    };
  }
}
