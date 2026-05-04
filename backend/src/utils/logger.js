// src/utils/logger.js — Winston structured logger
const winston = require('winston');

const { combine, timestamp, errors, printf, colorize, simple } = winston.format;

const jsonFormat = combine(
  timestamp(),
  errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  printf(({ level, message, timestamp: ts, stack }) =>
    stack ? `${ts} ${level}: ${message}\n${stack}` : `${ts} ${level}: ${message}`
  )
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'info'),
  transports: [
    new winston.transports.Console({ format: consoleFormat }),
  ],
});

if (process.env.LOG_FILE) {
  logger.add(new winston.transports.File({
    filename: process.env.LOG_FILE,
    format: jsonFormat,
  }));
}

module.exports = logger;
