import axios, { AxiosInstance } from 'axios';
import os from 'os';
import { store } from '../store';

// Lazy singleton — created on first use so store is always initialized
let _client: AxiosInstance | null = null;

export function getApiClient(): AxiosInstance {
  if (_client) return _client;

  _client = axios.create({
    // baseURL read lazily so store is initialized before first call
    baseURL: store.get('apiBaseUrl') || 'https://api.autoreach.dev',
    timeout: 25000,
  });

  _client.interceptors.request.use((config) => {
    const token = store.get('workerToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    
    // Inject the worker secret to satisfy the API bridge requirements
    config.headers['X-Worker-Token']    = process.env.WORKER_SECRET || 'dev_secret_key';
    
    config.headers['X-Machine-Name']    = os.hostname();
    config.headers['X-Platform']        =
      process.platform === 'win32'  ? 'windows' :
      process.platform === 'darwin' ? 'macos'   : 'linux';
    config.headers['X-Worker-Version']  = store.get('workerVersion') || '2.0.0';
    return config;
  });

  // Exponential backoff retry interceptor
  _client.interceptors.response.use(undefined, async (err) => {
    const config = err.config;
    if (!config || !config.retryCount) {
      if (config) config.retryCount = 0;
    }

    const shouldRetry = err.response && (err.response.status === 429 || err.response.status >= 500);

    if (shouldRetry && config.retryCount < 3) {
      config.retryCount += 1;
      const delay = Math.pow(2, config.retryCount) * 1000 + Math.random() * 1000;
      console.warn(`[API Client] Retrying request to ${config.url} in ${Math.round(delay)}ms (Attempt ${config.retryCount})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return _client!(config);
    }

    return Promise.reject(err);
  });

  return _client;
}

// Convenience proxy — all callers use this
export const apiClient = new Proxy({} as AxiosInstance, {
  get(_target, prop) {
    return (getApiClient() as any)[prop];
  },
});
