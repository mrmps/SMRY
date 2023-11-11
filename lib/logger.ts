import pino from 'pino';

const logger = pino({
  browser: {},
  level: 'debug',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
  base: {
    env: process.env.NODE_ENV,
  },
});

export default logger;