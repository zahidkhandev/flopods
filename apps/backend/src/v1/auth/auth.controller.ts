import {
  Controller,
  Get,
  Post,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Body,
  Ip,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { V1AuthService } from './auth.service';
import { SendMagicLinkDto, VerifyMagicLinkDto } from './dto/magic-link.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UAParser } from 'ua-parser-js';
import { Public } from '../../common/decorators/common';
import { GitHubOAuthGuard, GoogleOAuthGuard, RefreshTokenGuard } from '../../common/guards/auth';
import { GetCurrentUserId } from '../../common/decorators/user';

@ApiTags('Authentication')
@Controller({ path: 'auth', version: '1' })
export class V1AuthController {
  constructor(private readonly authService: V1AuthService) {}

  // ============================================
  // EMAIL/PASSWORD AUTHENTICATION
  // ============================================

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register new user with email and password' })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully. Verification email sent.',
  })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.firstName, dto.lastName, dto.password);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email address' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired verification token' })
  async verifyEmail(@Body() dto: { token: string }) {
    return this.authService.verifyEmail(dto.token);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful. Returns access and refresh tokens.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or email not verified' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const uaString = req.headers['user-agent'] || '';
    const parser = new UAParser(uaString);
    const os = parser.getOS().name || 'Unknown OS';
    const browser = parser.getBrowser().name || 'Unknown Browser';
    const deviceName = `${os} – ${browser}`;

    return this.authService.login(dto.email, dto.password, deviceName);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset link' })
  @ApiResponse({ status: 200, description: 'If email exists, password reset link sent' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token from email' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired reset token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  // ============================================
  // MAGIC LINK AUTHENTICATION
  // ============================================

  @Public()
  @Post('magic-link/send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send passwordless magic link to email' })
  @ApiResponse({ status: 200, description: 'If email exists, magic link sent' })
  @ApiResponse({ status: 429, description: 'Too many attempts. Try again later.' })
  async sendMagicLink(@Body() dto: SendMagicLinkDto, @Req() req: Request, @Ip() ipAddress: string) {
    const uaString = req.headers['user-agent'] || '';
    const parser = new UAParser(uaString);
    const os = parser.getOS().name || 'Unknown OS';
    const browser = parser.getBrowser().name || 'Unknown Browser';
    const deviceName = `${os} – ${browser}`;

    return this.authService.sendMagicLink(dto.email, deviceName, ipAddress || 'unknown');
  }

  @Public()
  @Post('magic-link/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify magic link token and get JWT tokens' })
  @ApiResponse({
    status: 200,
    description: 'Magic link verified. Returns access and refresh tokens.',
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired magic link' })
  async verifyMagicLink(
    @Body() dto: VerifyMagicLinkDto & { email: string },
    @Req() req: Request,
    @Ip() ipAddress: string,
  ) {
    const uaString = req.headers['user-agent'] || '';
    const parser = new UAParser(uaString);
    const os = parser.getOS().name || 'Unknown OS';
    const browser = parser.getBrowser().name || 'Unknown Browser';
    const deviceName = `${os} – ${browser}`;

    return this.authService.verifyMagicLink(
      dto.token,
      dto.email,
      deviceName,
      ipAddress || 'unknown',
    );
  }

  // ============================================
  // OAUTH AUTHENTICATION
  // ============================================

  @Public()
  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth login flow' })
  @ApiResponse({ status: 302, description: 'Redirects to Google OAuth consent screen' })
  async googleAuth() {}

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  @UseInterceptors()
  @ApiOperation({ summary: 'Google OAuth callback endpoint' })
  @ApiResponse({ status: 302, description: 'Redirects to frontend with tokens' })
  async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as any;

    if (!user) {
      const frontendUrl = this.authService['configService'].get('FRONTEND_URL');
      return res.redirect(`${frontendUrl}/auth/error?message=Authentication failed`);
    }

    const frontendUrl = this.authService['configService'].get('FRONTEND_URL');
    const params = new URLSearchParams({
      accessToken: user.accessToken,
      refreshToken: user.refreshToken,
      userId: user.userId,
      deviceId: user.deviceId,
    });

    res.redirect(`${frontendUrl}/auth/callback?${params.toString()}`);
  }

  @Public()
  @Get('github')
  @UseGuards(GitHubOAuthGuard)
  @ApiOperation({ summary: 'Initiate GitHub OAuth login flow' })
  @ApiResponse({ status: 302, description: 'Redirects to GitHub OAuth consent screen' })
  async githubAuth() {}

  @Public()
  @Get('github/callback')
  @UseGuards(GitHubOAuthGuard)
  @UseInterceptors() // ← Clear all interceptors for this route
  @ApiOperation({ summary: 'GitHub OAuth callback endpoint' })
  @ApiResponse({ status: 302, description: 'Redirects to frontend with tokens' })
  async githubAuthCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as any;

    if (!user) {
      const frontendUrl = this.authService['configService'].get('FRONTEND_URL');
      return res.redirect(`${frontendUrl}/auth/error?message=Authentication failed`);
    }

    const frontendUrl = this.authService['configService'].get('FRONTEND_URL');
    const params = new URLSearchParams({
      accessToken: user.accessToken,
      refreshToken: user.refreshToken,
      userId: user.userId,
      deviceId: user.deviceId,
    });

    res.redirect(`${frontendUrl}/auth/callback?${params.toString()}`);
  }

  // ============================================
  // TOKEN MANAGEMENT
  // ============================================

  @Public()
  @Post('refresh')
  @UseGuards(RefreshTokenGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({ status: 200, description: 'New access and refresh tokens generated' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refreshTokens(@Req() req: any, @Body() body: { deviceId: string }) {
    return this.authService.refreshTokens(req.user.refreshToken, body.deviceId);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout from current device' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(@GetCurrentUserId() userId: string, @Req() req: Request) {
    const deviceId = req.headers['x-device-id'] as string;
    return this.authService.logout(userId, deviceId);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout from all devices' })
  @ApiResponse({ status: 200, description: 'Logged out from all devices' })
  async logoutAll(@GetCurrentUserId() userId: string) {
    return this.authService.logoutAllDevices(userId);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user info' })
  @ApiResponse({ status: 200, description: 'Returns current user ID' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getCurrentUser(@GetCurrentUserId() userId: string) {
    return { userId };
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend email verification link' })
  @ApiResponse({ status: 200, description: 'Verification email sent if user exists' })
  @ApiResponse({ status: 429, description: 'Too many attempts' })
  async resendVerification(@Body() dto: { email: string }) {
    return this.authService.resendVerificationEmail(dto.email);
  }

  @Get('email-verified-status')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if current user email is verified' })
  @ApiResponse({ status: 200, description: 'Returns verification status' })
  async checkEmailVerified(@GetCurrentUserId() userId: string) {
    return this.authService.checkEmailVerifiedStatus(userId);
  }
}
