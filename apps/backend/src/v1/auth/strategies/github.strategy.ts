import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, StrategyOptionsWithRequest } from 'passport-github2';
import { ConfigService } from '@nestjs/config';
import { V1AuthService } from '../auth.service';
import { Request } from 'express';
import { UAParser } from 'ua-parser-js';

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, 'github') {
  private readonly logger = new Logger(GitHubStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: V1AuthService,
  ) {
    const options: StrategyOptionsWithRequest = {
      clientID: configService.get<string>('GITHUB_CLIENT_ID') || '',
      clientSecret: configService.get<string>('GITHUB_CLIENT_SECRET') || '',
      callbackURL: configService.get<string>('GITHUB_CALLBACK_URL') || '',
      scope: ['user:email'],
      passReqToCallback: true,
    };
    super(options);
  }

  async validate(
    req: Request,
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (error: any, user?: any) => void,
  ): Promise<void> {
    try {
      const uaString = req.headers['user-agent'] || '';
      const parser = new UAParser(uaString);
      const os = parser.getOS().name || 'Unknown OS';
      const browser = parser.getBrowser().name || 'Unknown Browser';
      const deviceName = `${os} – ${browser}`;

      const email = profile.emails?.[0]?.value || '';
      const name = profile.displayName || profile.username || '';
      const avatarUrl = profile.photos?.[0]?.value || '';
      const githubId = profile.id;

      this.logger.log(`GitHub OAuth: ${email}`);

      const user = await this.authService.validateGitHubUser({
        email,
        name,
        githubId,
        avatarUrl,
        deviceName,
      });

      done(null, user);
    } catch (error: any) {
      this.logger.error('Error in GitHubStrategy.validate()', error?.stack || error);
      done(error, false); // Use false instead of null
    }
  }
}
