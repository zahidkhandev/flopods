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

// Refresh token response structure
interface RefreshTokenResponse {
  statusCode: number;
  message: string;
  data: {
    accessToken: string;
    refreshToken: string;
    deviceId: string;
  };
}

// Queue to manage requests during token refresh
interface FailedRequest {
  resolve: (token: string) => void;
  reject: (error: any) => void;
}

let isRefreshing = false;
let failedQueue: FailedRequest[] = [];

const processQueue = (error: any, token: string | null = null): void => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request interceptor: attach token or skip if x-public header
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    // Check for x-public header to skip auth
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

// Response interceptor: handle token refresh
axiosInstance.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => response,
  async (error: AxiosError): Promise<any> => {
    const originalRequest = error.config as CustomAxiosRequestConfig;

    // No response received (network error)
    if (!error.response) {
      console.error('No response received:', error);
      return Promise.reject(error);
    }

    // Handle 401 errors (unauthorized)
    if (
      error.response.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/register') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      // If already refreshing, queue this request
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
        // Attempt token refresh
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

        // Update original request with new token
        (originalRequest.headers as AxiosHeaders).set(
          'Authorization',
          `Bearer ${newTokens.accessToken}`
        );

        // Process queued requests
        processQueue(null, newTokens.accessToken);

        // Retry original request
        return axiosInstance(originalRequest);
      } catch (err) {
        // Refresh failed - logout user
        processQueue(err, null);
        clearAuthTokens();
        window.location.href = '/auth/login';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
