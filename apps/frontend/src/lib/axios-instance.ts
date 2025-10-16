// lib/axios-instance.ts

import axios, { AxiosError, AxiosHeaders, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { toast } from 'sonner';
import { getAuthTokens, setAuthTokens, clearAuthTokens } from '@/utils/token-utils';
import { AuthTokens } from '@/types/auth';

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  showErrorToast?: boolean; // ✅ NEW: Optional flag to show error toast
}

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const axiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ==========================================
// OFFLINE REDIRECT HELPERS
// ==========================================

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
    // EMPTY
  }
}

export function redirectFromOfflineIfNeeded() {
  try {
    const pending = sessionStorage.getItem(OFFLINE_REDIRECT_FLAG) === '1';
    if (!pending) return;

    const prev = sessionStorage.getItem(PRE_ERROR_PATH) || '/dashboard';
    sessionStorage.removeItem(OFFLINE_REDIRECT_FLAG);
    sessionStorage.removeItem(PRE_ERROR_PATH);

    window.location.replace(prev);
  } catch {
    window.location.replace('/dashboard');
  }
}

// ==========================================
// REFRESH TOKEN HANDLING
// ==========================================

interface RefreshTokenResponse {
  statusCode: number;
  message: string;
  data: {
    accessToken: string;
    refreshToken: string;
    deviceId: string;
  };
}

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

// ==========================================
// REQUEST INTERCEPTOR
// ==========================================

axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    // Skip auth for public endpoints
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

// ==========================================
// RESPONSE INTERCEPTOR
// ==========================================

axiosInstance.interceptors.response.use(
  // ✅ SUCCESS
  (response: AxiosResponse): AxiosResponse => {
    if (window.location.pathname.includes('/errors/offline')) {
      redirectFromOfflineIfNeeded();
    }
    return response;
  },

  async (error: AxiosError): Promise<any> => {
    const originalRequest = error.config as CustomAxiosRequestConfig;
    const showErrorToast = originalRequest?.showErrorToast === true; // ✅ Default true

    // ==========================================
    // NETWORK ERROR (No Internet)
    // ==========================================
    if (!error.response) {
      console.error('Network error:', error.message);

      if (showErrorToast) {
        toast.error('No internet connection', {
          description: 'Please check your network and try again',
          duration: 5000,
        });
      }

      markOfflineAndRememberPath();

      // Only redirect if not already on offline page
      if (!window.location.pathname.includes('/errors/offline')) {
        window.location.href = '/errors/offline';
      }
      return Promise.reject(error);
    }

    const status = error.response.status;
    const errorData = error.response.data as any;
    const errorMessage = errorData?.message || 'An error occurred';

    // ==========================================
    // 401 UNAUTHORIZED (Token Refresh)
    // ==========================================
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
        if (showErrorToast) {
          toast.error('Session expired', {
            description: 'Please log in again',
          });
        }
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
        if (showErrorToast) {
          toast.error('Session expired', {
            description: 'Please log in again',
          });
        }
        window.location.href = '/auth/login';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    // ==========================================
    // 403 FORBIDDEN
    // ==========================================
    if (status === 403) {
      console.error('Access forbidden:', errorData);
      if (showErrorToast) {
        toast.error('Access denied', {
          description: errorMessage || "You don't have permission to access this resource",
        });
      }
      return Promise.reject(error);
    }

    // ==========================================
    // 404 NOT FOUND
    // ==========================================
    if (status === 404) {
      console.error('Resource not found:', errorData);
      if (showErrorToast) {
        toast.error('Not found', {
          description: errorMessage || 'The requested resource was not found',
        });
      }
      return Promise.reject(error);
    }

    // ==========================================
    // 409 CONFLICT
    // ==========================================
    if (status === 409) {
      console.error('Conflict:', errorData);
      if (showErrorToast) {
        toast.error('Conflict', {
          description: errorMessage || 'A conflict occurred with existing data',
        });
      }
      return Promise.reject(error);
    }

    // ==========================================
    // 422 VALIDATION ERROR
    // ==========================================
    if (status === 422) {
      console.error('Validation error:', errorData);
      if (showErrorToast) {
        toast.error('Validation error', {
          description: errorMessage || 'Please check your input and try again',
        });
      }
      return Promise.reject(error);
    }

    // ==========================================
    // 429 TOO MANY REQUESTS
    // ==========================================
    if (status === 429) {
      console.error('Rate limit exceeded:', errorData);
      if (showErrorToast) {
        toast.error('Too many requests', {
          description: 'Please wait a moment before trying again',
          duration: 5000,
        });
      }
      return Promise.reject(error);
    }

    // ==========================================
    // 500 INTERNAL SERVER ERROR
    // ==========================================
    if (status === 500) {
      console.error('Server error:', errorData);
      if (showErrorToast) {
        toast.error('Server error', {
          description: errorMessage || 'Something went wrong on our end. Please try again later',
          duration: 5000,
        });
      }
      return Promise.reject(error);
    }

    // ==========================================
    // 502 BAD GATEWAY
    // ==========================================
    if (status === 502) {
      console.error('Bad gateway:', errorData);
      if (showErrorToast) {
        toast.error('Service temporarily unavailable', {
          description: 'Our servers are having issues. Please try again in a few moments',
          duration: 5000,
        });
      }
      return Promise.reject(error);
    }

    // ==========================================
    // 503 SERVICE UNAVAILABLE
    // ==========================================
    if (status === 503) {
      console.error('Service unavailable:', errorData);
      if (showErrorToast) {
        toast.error('Service unavailable', {
          description: 'The service is temporarily down for maintenance',
          duration: 5000,
        });
      }
      return Promise.reject(error);
    }

    // ==========================================
    // OTHER ERRORS (4xx, 5xx)
    // ==========================================
    if (status >= 400) {
      console.error('HTTP error:', status, errorData);
      if (showErrorToast) {
        toast.error('Request failed', {
          description: errorMessage || `An error occurred (${status})`,
        });
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
