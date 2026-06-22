export const logger = {
  info: (message: string, meta: Record<string, any> = {}) => {
    console.log(JSON.stringify({ level: 'info', timestamp: new Date().toISOString(), message, ...meta }));
  },
  warn: (message: string, meta: Record<string, any> = {}) => {
    console.warn(JSON.stringify({ level: 'warn', timestamp: new Date().toISOString(), message, ...meta }));
  },
  error: (message: string, meta: Record<string, any> = {}) => {
    console.error(JSON.stringify({ level: 'error', timestamp: new Date().toISOString(), message, ...meta }));
  },
  debug: (message: string, meta: Record<string, any> = {}) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(JSON.stringify({ level: 'debug', timestamp: new Date().toISOString(), message, ...meta }));
    }
  }
};
