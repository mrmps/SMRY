import pino from 'pino';

/**
 * Centralized logger using Pino
 * - Development: JSON logs (compatible with Next.js)
 * - Production: JSON structured logs for parsing/monitoring
 * - Supports: debug, info, warn, error levels
 * 
 * Note: pino-pretty transport is disabled because it uses worker threads
 * that don't work in Next.js API routes. For pretty logs in development,
 * pipe the output through pino-pretty CLI: `npm run dev | pino-pretty`
 */
const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  
  // Base fields included in every log
  base: {
    env: process.env.NODE_ENV,
  },
  
  // Custom serializers for common objects
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
  
  // Format for better readability in development (no worker threads)
  ...(process.env.NODE_ENV !== 'production' && {
    formatters: {
      level: (label) => {
        return { level: label };
      },
    },
  }),
});

/**
 * Child logger for specific contexts
 * Usage: const log = createLogger('api:article')
 */
export function createLogger(context: string) {
  return logger.child({ context });
}

/**
 * Default export for general use
 */
export default logger;