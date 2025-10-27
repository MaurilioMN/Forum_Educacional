const CONNECTIVITY_PATTERNS = [
  'failed to fetch',
  'fetch failed',
  'networkerror',
  'network request failed',
  'getaddrinfo enotfound',
  'econnrefused',
  'etimedout',
  'connection refused'
];

const globalConfig = window.__APP_CONFIG__ ?? {};
const metaApiUrl = document
  .querySelector('meta[name="api-base-url"]')
  ?.getAttribute('content')
  ?.trim();
const configuredBase =
  (typeof globalConfig.apiUrl === 'string' && globalConfig.apiUrl.trim()) ||
  (typeof metaApiUrl === 'string' && metaApiUrl) ||
  '';

function stripTrailingSlashes(value) {
  return value.replace(/\/+$/, '');
}

const defaultBase = window.location.origin;
const resolvedBase = configuredBase || defaultBase;
const API_BASE_URL = stripTrailingSlashes(resolvedBase);

function normalizePath(path = '/') {
  if (!path.startsWith('/')) {
    return `/${path}`;
  }
  return path;
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export function buildApiUrl(path = '/', params) {
  const url = new URL(normalizePath(path), `${API_BASE_URL}/`);

  if (params && typeof params === 'object') {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && `${value}` !== '') {
        url.searchParams.set(key, value);
      }
    });
  }

  return url.toString();
}

function isConnectivityMessage(message = '') {
  const normalized = message.toLowerCase();
  return CONNECTIVITY_PATTERNS.some(pattern => normalized.includes(pattern));
}

export function isConnectivityError(error) {
  if (!error) return false;
  if (error instanceof TypeError) {
    return true;
  }

  if (typeof error.message === 'string' && isConnectivityMessage(error.message)) {
    return true;
  }

  if (typeof error.cause?.message === 'string' && isConnectivityMessage(error.cause.message)) {
    return true;
  }

  if (typeof error.code === 'string' && isConnectivityMessage(error.code)) {
    return true;
  }

  return false;
}

export function describeFetchError(error, fallbackMessage = 'Request failed') {
  if (isConnectivityError(error)) {
    return 'Unable to reach the server or database. Please verify your network connection and Supabase configuration.';
  }

  if (error && typeof error.message === 'string' && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}
