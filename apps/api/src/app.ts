import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './utils/config';
import { logger } from './utils/logger';
import { redis } from './utils/redis';
import { prisma } from './utils/database';

// Import routes
import healthRoutes from './routes/health';
import paymentRoutes from './routes/payments';
import webhookRoutes from './routes/webhooks';

// Import GraphQL
import { createYoga } from 'graphql-yoga';
import { schema } from './graphql/schema';

export async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'development',
    requestIdLogLabel: 'correlationId',
    genReqId: () => `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  });

  // Security middleware
  await app.register(helmet, {
    contentSecurityPolicy: false, // Disable CSP for Swagger UI
  });

  await app.register(cors, {
    origin: process.env.NODE_ENV === 'production' ? false : true,
    credentials: true,
  });

  // Rate limiting
  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
    redis: redis,
    skipOnError: true,
  });

  // Swagger documentation
  await app.register(swagger, {
    swagger: {
      info: {
        title: 'OpenPayFlow API',
        description: 'Payment orchestration sandbox API',
        version: '0.1.0',
      },
      host: `localhost:${config.PORT}`,
      schemes: ['http'],
      consumes: ['application/json'],
      produces: ['application/json'],
      tags: [
        { name: 'health', description: 'Health check endpoints' },
        { name: 'payments', description: 'Payment operations' },
        { name: 'refunds', description: 'Refund operations' },
        { name: 'webhooks', description: 'Webhook management' },
      ],
      securityDefinitions: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'Authorization',
          description: 'API key authorization header (Bearer <api_key>)',
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  // Register routes
  await app.register(healthRoutes, { prefix: '/v1' });
  await app.register(paymentRoutes, { prefix: '/v1' });
  await app.register(webhookRoutes, { prefix: '/v1' });

  // GraphQL endpoint
  if (config.ENABLE_GRAPHQL) {
    const yoga = createYoga({
      schema,
      graphqlEndpoint: '/graphql',
      context: async () => ({
        prisma,
        redis,
        logger,
      }),
    });

    app.route({
      url: '/graphql',
      method: ['GET', 'POST', 'OPTIONS'],
      handler: async (req, reply) => {
        const response = await yoga.handleNodeRequest(req);
        
        response.headers.forEach((value, key) => {
          reply.header(key, value);
        });
        
        reply.status(response.status);
        reply.send(response.body);
      },
    });
  }

  // Global error handler
  app.setErrorHandler(async (error, request, reply) => {
    logger.error({
      error: error.message,
      stack: error.stack,
      correlationId: request.id,
      url: request.url,
      method: request.method,
    }, 'Request error');

    const statusCode = error.statusCode || 500;
    
    reply.status(statusCode).send({
      success: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: statusCode === 500 ? 'Internal server error' : error.message,
        correlationId: request.id,
      },
    });
  });

  // 404 handler
  app.setNotFoundHandler(async (request, reply) => {
    reply.status(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
        correlationId: request.id,
      },
    });
  });

  return app;
}
