import { FastifyPluginAsync } from 'fastify';
import {
  CreateWebhookEndpointSchema,
  ValidationError,
  HTTP_STATUS,
} from '@openpayflow/common';
import { WebhookService } from '../services/webhook-service';
import { prisma } from '../utils/database';
import { redis } from '../utils/redis';
import { logger } from '../utils/logger';

const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  const webhookService = new WebhookService(prisma, redis, logger);

  // Create Webhook Endpoint
  fastify.post('/webhook-endpoints', {
    schema: {
      tags: ['webhooks'],
      summary: 'Create a webhook endpoint',
      description: 'Creates a new webhook endpoint to receive event notifications',
      body: {
        type: 'object',
        required: ['url', 'secret', 'events', 'merchantApiKey'],
        properties: {
          url: {
            type: 'string',
            format: 'uri',
            description: 'URL to receive webhook notifications',
          },
          secret: {
            type: 'string',
            minLength: 8,
            description: 'Secret key for webhook signature verification',
          },
          events: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            description: 'Array of event types to listen for',
          },
          merchantApiKey: {
            type: 'string',
            description: 'Merchant API key for authentication',
          },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                url: { type: 'string' },
                events: { type: 'array' },
                isActive: { type: 'boolean' },
                createdAt: { type: 'string' },
              },
            },
          },
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  }, async (request, reply) => {
    try {
      const validatedData = CreateWebhookEndpointSchema.parse(request.body);
      
      const endpoint = await webhookService.createWebhookEndpoint(validatedData);

      reply.status(HTTP_STATUS.CREATED);
      return {
        success: true,
        data: endpoint,
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        reply.status(HTTP_STATUS.BAD_REQUEST);
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message,
            correlationId: request.id,
          },
        };
      }
      throw error;
    }
  });

  // List Webhook Endpoints
  fastify.get('/webhook-endpoints', {
    schema: {
      tags: ['webhooks'],
      summary: 'List webhook endpoints',
      description: 'Retrieves all webhook endpoints for a merchant',
      querystring: {
        type: 'object',
        required: ['merchantApiKey'],
        properties: {
          merchantApiKey: {
            type: 'string',
            description: 'Merchant API key for authentication',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  url: { type: 'string' },
                  events: { type: 'array' },
                  isActive: { type: 'boolean' },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  }, async (request, reply) => {
    const { merchantApiKey } = request.query as { merchantApiKey: string };

    const endpoints = await webhookService.listWebhookEndpoints(merchantApiKey);

    return {
      success: true,
      data: endpoints,
    };
  });

  // Get Webhook Endpoint
  fastify.get('/webhook-endpoints/:id', {
    schema: {
      tags: ['webhooks'],
      summary: 'Get webhook endpoint details',
      description: 'Retrieves details of a specific webhook endpoint including recent deliveries',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            description: 'Webhook endpoint ID',
          },
        },
      },
      querystring: {
        type: 'object',
        required: ['merchantApiKey'],
        properties: {
          merchantApiKey: {
            type: 'string',
            description: 'Merchant API key for authentication',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                url: { type: 'string' },
                events: { type: 'array' },
                isActive: { type: 'boolean' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
                deliveries: { type: 'array' },
              },
            },
          },
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { merchantApiKey } = request.query as { merchantApiKey: string };

    const endpoint = await webhookService.getWebhookEndpoint(id, merchantApiKey);

    return {
      success: true,
      data: endpoint,
    };
  });

  // Update Webhook Endpoint
  fastify.patch('/webhook-endpoints/:id', {
    schema: {
      tags: ['webhooks'],
      summary: 'Update webhook endpoint',
      description: 'Updates a webhook endpoint configuration',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            description: 'Webhook endpoint ID',
          },
        },
      },
      body: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            format: 'uri',
            description: 'URL to receive webhook notifications',
          },
          secret: {
            type: 'string',
            minLength: 8,
            description: 'Secret key for webhook signature verification',
          },
          events: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            description: 'Array of event types to listen for',
          },
          isActive: {
            type: 'boolean',
            description: 'Whether the endpoint is active',
          },
          merchantApiKey: {
            type: 'string',
            description: 'Merchant API key for authentication',
          },
        },
        required: ['merchantApiKey'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                url: { type: 'string' },
                events: { type: 'array' },
                isActive: { type: 'boolean' },
                updatedAt: { type: 'string' },
              },
            },
          },
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { merchantApiKey, ...updates } = request.body as any;

    const endpoint = await webhookService.updateWebhookEndpoint(id, merchantApiKey, updates);

    return {
      success: true,
      data: endpoint,
    };
  });

  // Delete Webhook Endpoint
  fastify.delete('/webhook-endpoints/:id', {
    schema: {
      tags: ['webhooks'],
      summary: 'Delete webhook endpoint',
      description: 'Deletes a webhook endpoint',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            description: 'Webhook endpoint ID',
          },
        },
      },
      querystring: {
        type: 'object',
        required: ['merchantApiKey'],
        properties: {
          merchantApiKey: {
            type: 'string',
            description: 'Merchant API key for authentication',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { merchantApiKey } = request.query as { merchantApiKey: string };

    await webhookService.deleteWebhookEndpoint(id, merchantApiKey);

    return {
      success: true,
    };
  });

  // Simulate Webhook (for testing)
  fastify.post('/webhooks/test', {
    schema: {
      tags: ['webhooks'],
      summary: 'Simulate webhook event',
      description: 'Simulates a webhook event for testing purposes (development only)',
      body: {
        type: 'object',
        required: ['eventType', 'payload', 'merchantApiKey'],
        properties: {
          eventType: {
            type: 'string',
            enum: [
              'payment.created',
              'payment.succeeded',
              'payment.failed',
              'refund.created',
              'refund.succeeded',
              'refund.failed',
            ],
            description: 'Type of event to simulate',
          },
          payload: {
            type: 'object',
            description: 'Event payload data',
          },
          merchantApiKey: {
            type: 'string',
            description: 'Merchant API key for authentication',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                eventId: { type: 'string' },
                deliveries: { type: 'integer' },
              },
            },
          },
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  }, async (request, reply) => {
    // Only allow in development/test environments
    if (process.env.NODE_ENV === 'production') {
      reply.status(HTTP_STATUS.FORBIDDEN);
      return {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Test webhooks are not available in production',
        },
      };
    }

    const { eventType, payload, merchantApiKey } = request.body as any;

    const result = await webhookService.simulateWebhook(eventType, payload, merchantApiKey);

    return {
      success: true,
      data: {
        eventId: result.event.id,
        deliveries: result.deliveries,
      },
    };
  });
};

export default webhookRoutes;
