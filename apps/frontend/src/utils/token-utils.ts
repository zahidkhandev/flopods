import Cookies from 'js-cookie';
import CryptoJS from 'crypto-js';
import { AuthTokens } from '@/types/auth';

// Encryption secret key (secure it in environment variables)
const ENCRYPTION_KEY =
  import.meta.env.VITE_TOKEN_ENCRYPTION_KEY || 'actopod_secure_key_2025_change_in_production';

// Detect environment
const hostname = window.location.hostname;
const isProdHost = hostname !== 'localhost' && !hostname.startsWith('127.0.0.1');

// Shared cookie options
const COOKIE_OPTIONS: Cookies.CookieAttributes = isProdHost
  ? {
      domain: window.location.hostname,
      path: '/',
      secure: true, // HTTPS only
      sameSite: 'None', // cross-site
    }
  : {
      path: '/', // localhost
      secure: false, // allow HTTP in dev
      sameSite: 'Lax', // sane default
    };

// Utility to encrypt data
const encrypt = (data: string): string => CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();

// Utility to decrypt data
const decrypt = (encryptedData: string): string | undefined => {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted || undefined;
  } catch (error) {
    console.error('Failed to decrypt data:', error);
    return undefined;
  }
};

// Utility to set a cookie with encryption
const setCookie = (key: string, value: string, expiresInDays: number): void => {
  const encryptedValue = encrypt(value);
  Cookies.set(key, encryptedValue, {
    expires: expiresInDays,
    ...COOKIE_OPTIONS,
  });
};

// Utility to get a decrypted cookie
const getCookie = (key: string): string | undefined => {
  const encryptedValue = Cookies.get(key);
  if (!encryptedValue) return undefined;
  return decrypt(encryptedValue);
};

// Utility to remove a cookie
const removeCookie = (key: string): void => {
  Cookies.remove(key, COOKIE_OPTIONS);
};

// Keys for our auth cookies
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const DEVICE_ID_KEY = 'device_id';
const DEVICE_NAME_KEY = 'device_name';

/** Store all auth tokens with encryption. */
export const setAuthTokens = (tokens: AuthTokens): void => {
  setCookie(ACCESS_TOKEN_KEY, tokens.accessToken, 1); // 1 day
  setCookie(REFRESH_TOKEN_KEY, tokens.refreshToken, 7); // 7 days
  setCookie(DEVICE_ID_KEY, tokens.deviceId, 7); // 7 days
};

/** Store device name (persists longer). */
export const setDeviceName = (deviceName: string): void => {
  setCookie(DEVICE_NAME_KEY, deviceName, 365); // 1 year
};

/** Get device name. */
export const getDeviceName = (): string | undefined => {
  return getCookie(DEVICE_NAME_KEY);
};

/** Read tokens back out of cookies. */
export const getAuthTokens = (): AuthTokens | null => {
  const accessToken = getCookie(ACCESS_TOKEN_KEY);
  const refreshToken = getCookie(REFRESH_TOKEN_KEY);
  const deviceId = getCookie(DEVICE_ID_KEY);

  if (accessToken && refreshToken && deviceId) {
    return { accessToken, refreshToken, deviceId };
  }
  return null;
};

/** Clear all auth-related cookies. */
export const clearAuthTokens = (): void => {
  removeCookie(ACCESS_TOKEN_KEY);
  removeCookie(REFRESH_TOKEN_KEY);
  removeCookie(DEVICE_ID_KEY);
  // Keep device name even after logout
};
