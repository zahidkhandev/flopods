export interface JwtPayload {
  userId: string;
  email: string;
}

export interface JwtPayloadWithRt extends JwtPayload {
  refreshToken: string;
  deviceId: string;
}

export interface AuthUserType {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  deviceId: string;
  deviceName: string;
}

export interface GoogleUserData {
  email: string;
  firstName: string;
  lastName: string;
  googleId: string;
  picture?: string;
  deviceName: string;
}

export interface GitHubUserData {
  email: string;
  name: string;
  githubId: string;
  avatarUrl?: string;
  deviceName: string;
}

export interface MagicLinkData {
  email: string;
  token: string;
  expiresAt: Date;
  deviceName: string;
  ipAddress: string;
}
