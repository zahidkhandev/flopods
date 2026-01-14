import { toast as sonnerToast, ExternalToast } from 'sonner';

// Track active toasts to prevent duplicates
const activeToasts = new Map<string, number>();
const DEBOUNCE_TIME = 300;

const generateToastKey = (message: string, description?: string): string => {
  const descStr = description ? String(description) : '';
  return `${message}-${descStr}`;
};

const isToastActive = (key: string): boolean => {
  const timestamp = activeToasts.get(key);
  if (!timestamp) return false;

  const now = Date.now();
  const isActive = now - timestamp < DEBOUNCE_TIME;

  if (!isActive) {
    activeToasts.delete(key);
  }

  return isActive;
};

const markToastActive = (key: string): void => {
  activeToasts.set(key, Date.now());
  setTimeout(() => {
    activeToasts.delete(key);
  }, DEBOUNCE_TIME + 100);
};

// Wrapper functions
export function success(message: string, data?: ExternalToast) {
  const description = data?.description ? String(data.description) : undefined;
  const key = generateToastKey(message, description);
  if (isToastActive(key)) return;

  markToastActive(key);
  return sonnerToast.success(message, data);
}

export function error(message: string, data?: ExternalToast) {
  const description = data?.description ? String(data.description) : undefined;
  const key = generateToastKey(message, description);
  if (isToastActive(key)) return;

  markToastActive(key);
  return sonnerToast.error(message, data);
}

export function info(message: string, data?: ExternalToast) {
  const description = data?.description ? String(data.description) : undefined;
  const key = generateToastKey(message, description);
  if (isToastActive(key)) return;

  markToastActive(key);
  return sonnerToast.info(message, data);
}

export function warning(message: string, data?: ExternalToast) {
  const description = data?.description ? String(data.description) : undefined;
  const key = generateToastKey(message, description);
  if (isToastActive(key)) return;

  markToastActive(key);
  return sonnerToast.warning(message, data);
}

export function loading(message: string, data?: ExternalToast) {
  const description = data?.description ? String(data.description) : undefined;
  const key = generateToastKey(message, description);
  if (isToastActive(key)) return;

  markToastActive(key);
  return sonnerToast.loading(message, data);
}

// Use wrapper function instead of direct export
export function promise<T>(promiseToRun: Promise<T> | (() => Promise<T>), data?: any) {
  return sonnerToast.promise(promiseToRun, data);
}

// Direct exports for other methods
export const custom = sonnerToast.custom;
export const dismiss = sonnerToast.dismiss;
export const message = sonnerToast.message;

// Default export as object
export const toast = {
  success,
  error,
  info,
  warning,
  loading,
  promise,
  custom,
  dismiss,
  message,
};

export default toast;
