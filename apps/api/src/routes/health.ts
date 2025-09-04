import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../utils/database';
import { redis } from '../utils/redis';

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  // Health check endpoint
  fastify.get('/healthz', {
    schema: {
      tags: ['health'],
      summary: 'Health check',
      description: 'Returns the health status of the service',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            uptime: { type: 'number' },
          },
        },
      },
    },
  }, async (request, reply) => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  // Readiness check endpoint
  fastify.get('/readyz', {
    schema: {
      tags: ['health'],
      summary: 'Readiness check',
      description: 'Returns the readiness status of the service and its dependencies',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            services: {
              type: 'object',
              properties: {
                database: { type: 'string' },
                redis: { type: 'string' },
              },
            },
          },
        },
        503: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            services: {
              type: 'object',
              properties: {
                database: { type: 'string' },
                redis: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const services = {
      database: 'unknown',
      redis: 'unknown',
    };

    let isReady = true;

    // Check database connection
    try {
      await prisma.$queryRaw`SELECT 1`;
      services.database = 'healthy';
    } catch (error) {
      services.database = 'unhealthy';
      isReady = false;
    }

    // Check Redis connection
    try {
      await redis.ping();
      services.redis = 'healthy';
    } catch (error) {
      services.redis = 'unhealthy';
      isReady = false;
    }

    const status = isReady ? 'ready' : 'not ready';
    const statusCode = isReady ? 200 : 503;

    reply.status(statusCode);
    return {
      status,
      timestamp: new Date().toISOString(),
      services,
    };
  });

  // Metrics endpoint (basic info)
  fastify.get('/metrics', {
    schema: {
      tags: ['health'],
      summary: 'Basic metrics',
      description: 'Returns basic service metrics',
      response: {
        200: {
          type: 'object',
          properties: {
            process: {
              type: 'object',
              properties: {
                uptime: { type: 'number' },
                memoryUsage: {
                  type: 'object',
                  properties: {
                    rss: { type: 'number' },
                    heapTotal: { type: 'number' },
                    heapUsed: { type: 'number' },
                    external: { type: 'number' },
                  },
                },
                cpuUsage: {
                  type: 'object',
                  properties: {
                    user: { type: 'number' },
                    system: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    return {
      process: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
      },
    };
  });
};

export default healthRoutes;
