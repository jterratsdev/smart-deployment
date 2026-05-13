/**
 * Simple internal logger for CacheManager
 * TODO: Replace with Logger utility when Issue #7 is completed
 */
export const cacheLogger = {
  warn: (message: string, context?: Record<string, unknown>): void => {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    // eslint-disable-next-line no-console
    console.warn(`[${timestamp}] [WARN] [CacheManager] ${message}${contextStr}`);
  },
  error: (message: string, context?: Record<string, unknown>): void => {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    // eslint-disable-next-line no-console
    console.error(`[${timestamp}] [ERROR] [CacheManager] ${message}${contextStr}`);
  },
};
