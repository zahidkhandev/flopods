// lib/axios-instance.ts
import axios, { AxiosError, AxiosHeaders, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { getAuthTokens, setAuthTokens, clearAuthTokens } from '@/utils/token-utils';
import { AuthTokens } from '@/types/auth';

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const axiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ---- Helpers to remember/restore previous route when going offline ----
const OFFLINE_REDIRECT_FLAG = 'offlineRedirectPending';
const PRE_ERROR_PATH = 'preErrorPath';

function markOfflineAndRememberPath() {
  try {
    if (!sessionStorage.getItem(PRE_ERROR_PATH)) {
      const current = window.location.pathname + window.location.search + window.location.hash;
      sessionStorage.setItem(PRE_ERROR_PATH, current);
    }
    sessionStorage.setItem(OFFLINE_REDIRECT_FLAG, '1');
  } catch {
    //EMPTY
  }
}

export function redirectFromOfflineIfNeeded() {
  try {
    const pending = sessionStorage.getItem(OFFLINE_REDIRECT_FLAG) === '1';
    if (!pending) return;

    const prev = sessionStorage.getItem(PRE_ERROR_PATH) || '/dashboard';
    sessionStorage.removeItem(OFFLINE_REDIRECT_FLAG);
    sessionStorage.removeItem(PRE_ERROR_PATH);

    // Use replace so the /errors/offline page isn't kept in history
    window.location.replace(prev);
  } catch {
    window.location.replace('/dashboard');
  }
}

// ---- Refresh token response structure ----
interface RefreshTokenResponse {
  statusCode: number;
  message: string;
  data: {
    accessToken: string;
    refreshToken: string;
    deviceId: string;
  };
}

// ---- Queue to manage requests during token refresh ----
interface FailedRequest {
  resolve: (token: string) => void;
  reject: (error: any) => void;
}

let isRefreshing = false;
let failedQueue: FailedRequest[] = [];

const processQueue = (error: any, token: string | null = null): void => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else if (token) prom.resolve(token);
  });
  failedQueue = [];
};

// ---- Request interceptor: attach token or skip if x-public header ----
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    if (config.headers && config.headers['x-public'] === 'true') {
      delete config.headers['x-public'];
      return config;
    }

    const tokens = getAuthTokens();
    if (tokens?.accessToken) {
      (config.headers as AxiosHeaders).set('Authorization', `Bearer ${tokens.accessToken}`);
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// ---- Response interceptor: success + error handling ----
axiosInstance.interceptors.response.use(
  // ✅ SUCCESS: If we’re on the offline page and have a pending redirect, bounce back.
  (response: AxiosResponse): AxiosResponse => {
    if (window.location.pathname.includes('/errors/offline')) {
      redirectFromOfflineIfNeeded();
    }
    return response;
  },

  // ❌ ERROR
  async (error: AxiosError): Promise<any> => {
    const originalRequest = error.config as CustomAxiosRequestConfig;

    // ==================== NETWORK ERROR ====================
    if (!error.response) {
      console.error('Network error:', error.message);
      markOfflineAndRememberPath();

      if (!window.location.pathname.includes('/errors/offline')) {
        window.location.href = '/errors/offline';
      }
      return Promise.reject(error);
    }

    const status = error.response.status;

    // ==================== 401 UNAUTHORIZED ====================
    if (
      status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/register') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token: string) => {
            (originalRequest.headers as AxiosHeaders).set('Authorization', `Bearer ${token}`);
            return axiosInstance(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const tokens = getAuthTokens();
      if (!tokens?.refreshToken) {
        clearAuthTokens();
        window.location.href = '/auth/login';
        return Promise.reject(error);
      }

      try {
        const response = await axios.post<RefreshTokenResponse>(
          `${BASE_URL}/auth/refresh`,
          { deviceId: tokens.deviceId },
          {
            headers: { Authorization: `Bearer ${tokens.refreshToken}` },
            withCredentials: true,
          }
        );

        const newTokens: AuthTokens = {
          accessToken: response.data.data.accessToken,
          refreshToken: response.data.data.refreshToken,
          deviceId: tokens.deviceId,
        };

        setAuthTokens(newTokens);

        (originalRequest.headers as AxiosHeaders).set(
          'Authorization',
          `Bearer ${newTokens.accessToken}`
        );

        processQueue(null, newTokens.accessToken);

        return axiosInstance(originalRequest);
      } catch (err) {
        processQueue(err, null);
        clearAuthTokens();
        window.location.href = '/auth/login';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    // ==================== 403 FORBIDDEN ====================
    if (status === 403) {
      console.error('Access forbidden:', error.response.data);
      if (!window.location.pathname.includes('/errors/403')) {
        window.location.href = '/errors/403';
      }
      return Promise.reject(error);
    }

    // ==================== 404 NOT FOUND ====================
    if (status === 404) {
      console.error('Resource not found:', error.response.data);
      return Promise.reject(error);
    }

    // ==================== 500 INTERNAL SERVER ERROR ====================
    if (status === 500) {
      console.error('Server error:', error.response.data);
      if (!window.location.pathname.includes('/errors/500')) {
        window.location.href = '/errors/500';
      }
      return Promise.reject(error);
    }

    // ==================== 502 BAD GATEWAY ====================
    if (status === 502) {
      console.error('Bad gateway:', error.response.data);
      if (!window.location.pathname.includes('/errors/500')) {
        window.location.href = '/errors/500';
      }
      return Promise.reject(error);
    }

    // ==================== 503 SERVICE UNAVAILABLE ====================
    if (status === 503) {
      console.error('Service unavailable:', error.response.data);
      if (!window.location.pathname.includes('/errors/maintenance')) {
        window.location.href = '/errors/maintenance';
      }
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
