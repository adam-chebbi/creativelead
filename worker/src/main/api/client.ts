import axios from 'axios';
import os from 'os';
import { store } from '../store';

export function createApiClient() {
  const client = axios.create({
    baseURL: store.get('apiBaseUrl'),
    timeout: 20000,
  });

  client.interceptors.request.use((config) => {
    const token = store.get('workerToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    config.headers['X-Machine-Name']   = os.hostname();
    config.headers['X-Platform']       = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'macos' : 'linux';
    config.headers['X-Worker-Version'] = store.get('workerVersion');
    return config;
  });

  return client;
}

export const apiClient = createApiClient();
