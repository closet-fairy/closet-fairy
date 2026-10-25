import { ApiError } from './apiError';

const UNAUTHORIZED_STATUS = 401;

type Listener = () => void;

const listeners = new Set<Listener>();
let hasActiveSession = false;
let isExpired = false;

const notify = () => {
  listeners.forEach((listener) => listener());
};

export const isUnauthorizedError = (error: unknown) =>
  error instanceof ApiError && error.status === UNAUTHORIZED_STATUS;

export const markSessionActive = () => {
  hasActiveSession = true;
};

export const reportUnauthorized = () => {
  if (!hasActiveSession || isExpired) {
    return;
  }

  isExpired = true;
  notify();
};

export const resetSession = () => {
  hasActiveSession = false;

  if (isExpired) {
    isExpired = false;
    notify();
  }
};

export const getIsSessionExpired = () => isExpired;

export const subscribeSessionExpiry = (listener: Listener) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};
