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

  return _client;
}

// Convenience proxy — all callers use this
export const apiClient = new Proxy({} as AxiosInstance, {
  get(_target, prop) {
    return (getApiClient() as any)[prop];
  },
});
