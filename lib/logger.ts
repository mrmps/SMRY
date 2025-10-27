import pino from 'pino';

/**
 * Centralized logger using Pino
 * - Development: Pretty formatted, colorized output
 * - Production: JSON structured logs for parsing/monitoring
 * - Supports: debug, info, warn, error levels
 */
const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  
  // Production: JSON logs (parseable by log aggregators)
  // Development: Pretty printed with colors
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    },
  }),
  
  // Base fields included in every log
  base: {
    env: process.env.NODE_ENV,
  },
  
  // Custom serializers for common objects
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
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