import Store from 'electron-store';

import { randomUUID } from 'crypto';

interface StoreSchema {
  apiBaseUrl:    string;
  workerToken:   string;
  lastJobConfig: object;
  workerVersion: string;
  deviceId:      string;
}

export const store = new Store<StoreSchema>({
  schema: {
    apiBaseUrl:    { type: 'string', default: 'http://localhost:3000' }, // Changed to local dev for now, could be dynamic
    workerToken:   { type: 'string', default: '' },
    lastJobConfig: { type: 'object', default: {} },
    workerVersion: { type: 'string', default: '2.0.0' },
    deviceId:      { type: 'string', default: () => randomUUID() },
  },
  encryptionKey: 'autoreach-worker-v2',
});
