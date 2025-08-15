import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import * as Sentry from '@sentry/node';
import { config } from './config.js';
import { searchRoutes } from './routes/search.js';
import { parcelRoutes } from './routes/parcels.js';
import { tilesRoutes } from './routes/tiles.js';
import { regridRoutes } from './routes/regrid.js';
import { healthRoutes } from './routes/health.js';
import { adminRoutes } from './routes/admin.js';

// Initialize Sentry
if (config.SENTRY_DSN_API) {
  Sentry.init({
    dsn: config.SENTRY_DSN_API,
    environment: config.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}

const fastify = Fastify({
  logger: {
    level: config.NODE_ENV === 'development' ? 'debug' : 'info',
    transport: config.NODE_ENV === 'development' ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
      },
    } : undefined,
  },
});

// Security middleware
await fastify.register(helmet, {
  contentSecurityPolicy: false, // Handled by frontend
});

// CORS
await fastify.register(cors, {
  origin: [config.VITE_APP_URL, 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
  credentials: true,
});

// Rate limiting
await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  errorResponseBuilder: () => ({
    error: 'Rate limit exceeded',
    message: 'Too many requests, please try again later',
  }),
});

// Global error handler
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  
  if (config.SENTRY_DSN_API) {
    Sentry.captureException(error);
  }

  const statusCode = error.statusCode || 500;
  const message = statusCode === 500 ? 'Internal Server Error' : error.message;

  reply.status(statusCode).send({
    error: error.name || 'Error',
    message,
    statusCode,
  });
});

// Routes
await fastify.register(healthRoutes, { prefix: '/api' });
await fastify.register(searchRoutes, { prefix: '/api' });
await fastify.register(parcelRoutes, { prefix: '/api' });
await fastify.register(tilesRoutes, { prefix: '/api' });
await fastify.register(regridRoutes, { prefix: '/api' });
await fastify.register(adminRoutes, { prefix: '/api' });

// Start server
const start = async () => {
  try {
    const port = config.PORT;
    const host = config.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
    
    await fastify.listen({ port, host });
    fastify.log.info(`Server listening on ${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  fastify.log.info(`Received ${signal}, shutting down gracefully`);
  await fastify.close();
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

start();