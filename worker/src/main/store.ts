import Store from 'electron-store';

interface StoreSchema {
  apiBaseUrl:    string;
  workerToken:   string;
  lastJobConfig: object;
  workerVersion: string;
}

export const store = new Store<StoreSchema>({
  schema: {
    apiBaseUrl:    { type: 'string', default: 'https://api.autoreach.dev' },
    workerToken:   { type: 'string', default: '' },
    lastJobConfig: { type: 'object', default: {} },
    workerVersion: { type: 'string', default: '2.0.0' },
  },
  encryptionKey: 'autoreach-worker-v2',
});
