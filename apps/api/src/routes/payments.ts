import { FastifyPluginAsync } from 'fastify';
import {
  CreatePaymentSchema,
  CreateRefundSchema,
  PaymentError,
  ValidationError,
  HTTP_STATUS,
  PaymentStatus,
  GatewayName,
} from '@openpayflow/common';
import { PaymentService } from '../services/payment-service';
import { RefundService } from '../services/refund-service';
import { prisma } from '../utils/database';
import { redis } from '../utils/redis';
import { logger } from '../utils/logger';

const paymentRoutes: FastifyPluginAsync = async (fastify) => {
  const paymentService = new PaymentService(prisma, redis, logger);
  const refundService = new RefundService(prisma, redis, logger);

  // Create Payment
  fastify.post('/payments', {
    schema: {
      tags: ['payments'],
      summary: 'Create a new payment',
      description: 'Creates a new payment with idempotency support',
      headers: {
        type: 'object',
        required: ['idempotency-key'],
        properties: {
          'idempotency-key': {
            type: 'string',
            description: 'Unique key to ensure idempotent payment creation',
          },
        },
      },
      body: {
        type: 'object',
        required: ['amount', 'currency', 'gateway', 'merchantApiKey'],
        properties: {
          amount: {
            type: 'integer',
            minimum: 1,
            description: 'Payment amount in smallest currency unit (e.g., cents for USD)',
          },
          currency: {
            type: 'string',
            minLength: 3,
            maxLength: 3,
            description: 'Three-letter currency code (e.g., USD, EUR)',
          },
          gateway: {
            type: 'string',
            enum: ['stripe', 'razorpay', 'mock'],
            description: 'Payment gateway to use',
          },
          merchantApiKey: {
            type: 'string',
            description: 'Merchant API key for authentication',
          },
          metadata: {
            type: 'object',
            description: 'Additional metadata for the payment',
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
                amount: { type: 'integer' },
                currency: { type: 'string' },
                status: { type: 'string' },
                gateway: { type: 'string' },
                providerPaymentId: { type: 'string' },
                idempotencyKey: { type: 'string' },
                metadata: { type: 'object' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
              },
            },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                correlationId: { type: 'string' },
              },
            },
          },
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  }, async (request, reply) => {
    const idempotencyKey = request.headers['idempotency-key'] as string;
    
    if (!idempotencyKey) {
      throw new ValidationError('Idempotency-Key header is required');
    }

    try {
      // Validate request body
      const validatedData = CreatePaymentSchema.parse(request.body);
      
      const payment = await paymentService.createPayment(
        validatedData,
        idempotencyKey
      );

      reply.status(HTTP_STATUS.CREATED);
      return {
        success: true,
        data: payment,
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

  // Get Payment
  fastify.get('/payments/:id', {
    schema: {
      tags: ['payments'],
      summary: 'Get payment details',
      description: 'Retrieves details of a specific payment',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            description: 'Payment ID',
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
                amount: { type: 'integer' },
                currency: { type: 'string' },
                status: { type: 'string' },
                gateway: { type: 'string' },
                providerPaymentId: { type: 'string' },
                idempotencyKey: { type: 'string' },
                metadata: { type: 'object' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
                attempts: { type: 'array' },
                refunds: { type: 'array' },
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

    const payment = await paymentService.getPayment(id, merchantApiKey);

    return {
      success: true,
      data: payment,
    };
  });

  // List Payments
  fastify.get('/payments', {
    schema: {
      tags: ['payments'],
      summary: 'List payments',
      description: 'Retrieves a list of payments with optional filtering',
      querystring: {
        type: 'object',
        required: ['merchantApiKey'],
        properties: {
          merchantApiKey: {
            type: 'string',
            description: 'Merchant API key for authentication',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 50,
            description: 'Number of payments to return',
          },
          offset: {
            type: 'integer',
            minimum: 0,
            default: 0,
            description: 'Number of payments to skip',
          },
          status: {
            type: 'string',
            enum: ['pending', 'processing', 'requires_action', 'succeeded', 'failed', 'cancelled'],
            description: 'Filter by payment status',
          },
          gateway: {
            type: 'string',
            enum: ['stripe', 'razorpay', 'mock'],
            description: 'Filter by payment gateway',
          },
          startDate: {
            type: 'string',
            format: 'date-time',
            description: 'Filter payments created after this date',
          },
          endDate: {
            type: 'string',
            format: 'date-time',
            description: 'Filter payments created before this date',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array' },
            pagination: {
              type: 'object',
              properties: {
                total: { type: 'integer' },
                limit: { type: 'integer' },
                offset: { type: 'integer' },
                hasMore: { type: 'boolean' },
              },
            },
          },
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  }, async (request, reply) => {
    const query = request.query as any;
    
    const result = await paymentService.listPayments(query.merchantApiKey, {
      limit: query.limit,
      offset: query.offset,
      status: query.status as PaymentStatus,
      gateway: query.gateway as GatewayName,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    });

    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
    };
  });

  // Create Refund
  fastify.post('/refunds', {
    schema: {
      tags: ['refunds'],
      summary: 'Create a refund',
      description: 'Creates a refund for an existing payment',
      body: {
        type: 'object',
        required: ['paymentId', 'merchantApiKey'],
        properties: {
          paymentId: {
            type: 'string',
            description: 'ID of the payment to refund',
          },
          amount: {
            type: 'integer',
            minimum: 1,
            description: 'Refund amount in smallest currency unit (optional, defaults to full amount)',
          },
          reason: {
            type: 'string',
            description: 'Reason for the refund',
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
                paymentId: { type: 'string' },
                amount: { type: 'integer' },
                status: { type: 'string' },
                providerRefundId: { type: 'string' },
                reason: { type: 'string' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
              },
            },
          },
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  }, async (request, reply) => {
    try {
      const validatedData = CreateRefundSchema.parse(request.body);
      
      const refund = await refundService.createRefund(validatedData);

      reply.status(HTTP_STATUS.CREATED);
      return {
        success: true,
        data: refund,
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
};

export default paymentRoutes;
