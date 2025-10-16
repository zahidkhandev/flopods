import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import {
  Strategy,
  Profile,
  VerifyCallback,
  StrategyOptionsWithRequest,
} from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { V1AuthService } from '../auth.service';
import { Request } from 'express';
import { UAParser } from 'ua-parser-js';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: V1AuthService,
  ) {
    const options: StrategyOptionsWithRequest = {
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') || '',
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET') || '',
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL') || '',
      scope: ['email', 'profile'],
      passReqToCallback: true,
    };
    super(options);
  }

  async validate(
    req: Request,
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    try {
      const uaString = req.headers['user-agent'] || '';
      const parser = new UAParser(uaString);
      const os = parser.getOS().name || 'Unknown OS';
      const browser = parser.getBrowser().name || 'Unknown Browser';
      const deviceName = `${os} – ${browser}`;

      const email = profile.emails?.[0]?.value || '';
      const firstName = profile.name?.givenName || '';
      const lastName = profile.name?.familyName || '';
      const picture = profile.photos?.[0]?.value || '';
      const googleId = profile.id;

      this.logger.log(`Google OAuth: ${email}`);

      const user = await this.authService.validateGoogleUser({
        email,
        firstName,
        lastName,
        googleId,
        picture,
        deviceName,
      });

      done(null, user);
    } catch (error: any) {
      this.logger.error('Error in GoogleStrategy.validate()', error?.stack || error);
      done(error, false); // Use false instead of null
    }
  }
}
