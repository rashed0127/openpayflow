import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';
import {
  CreatePaymentRequest,
  PaymentStatus,
  PaymentAttemptStatus,
  GatewayName,
  PaymentError,
  GatewayError,
  CACHE_KEYS,
  CACHE_TTL,
  generateSecureId,
  hashString,
} from '@openpayflow/common';
import { gatewayFactory, GatewayConfig } from '@openpayflow/gateway-core';

export class PaymentService {
  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
    private logger: Logger
  ) {}

  async createPayment(
    request: CreatePaymentRequest,
    idempotencyKey: string
  ) {
    const correlationId = generateSecureId(8);
    
    this.logger.info({
      correlationId,
      idempotencyKey,
      amount: request.amount,
      currency: request.currency,
      gateway: request.gateway,
    }, 'Creating payment');

    // Validate merchant
    const merchant = await this.validateMerchant(request.merchantApiKey);
    
    // Check idempotency
    const existingPayment = await this.checkIdempotency(
      merchant.id,
      idempotencyKey
    );
    
    if (existingPayment) {
      this.logger.info({
        correlationId,
        paymentId: existingPayment.id,
      }, 'Returning existing payment due to idempotency key');
      
      return existingPayment;
    }

    // Create payment record
    const payment = await this.prisma.payment.create({
      data: {
        merchantId: merchant.id,
        amount: request.amount,
        currency: request.currency,
        status: 'PENDING',
        gateway: request.gateway.toUpperCase() as any,
        idempotencyKey,
        metadata: request.metadata || {},
      },
    });

    // Cache for idempotency
    await this.cachePaymentForIdempotency(merchant.id, idempotencyKey, payment.id);

    // Create initial attempt
    const attempt = await this.prisma.paymentAttempt.create({
      data: {
        paymentId: payment.id,
        attemptNo: 1,
        status: 'PENDING',
      },
    });

    // Process with gateway
    try {
      const result = await this.processWithGateway(
        payment,
        attempt,
        correlationId
      );
      
      // Create outbox event for webhook processing
      await this.createOutboxEvent(payment.id, 'payment.created', {
        payment: result,
        correlationId,
      });

      return result;
          } catch (error) {
        this.logger.error({
          correlationId,
          paymentId: payment.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        }, 'Payment processing failed');
      
      throw error;
    }
  }

  async getPayment(paymentId: string, merchantApiKey: string) {
    const merchant = await this.validateMerchant(merchantApiKey);
    
    const payment = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        merchantId: merchant.id,
      },
      include: {
        attempts: {
          orderBy: { attemptNo: 'desc' },
          take: 5,
        },
        refunds: true,
      },
    });

    if (!payment) {
      throw new PaymentError('Payment not found', 'PAYMENT_NOT_FOUND', 404);
    }

    return payment;
  }

  async listPayments(
    merchantApiKey: string,
    options: {
      limit?: number;
      offset?: number;
      status?: PaymentStatus;
      gateway?: GatewayName;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ) {
    const merchant = await this.validateMerchant(merchantApiKey);
    
    const where: any = {
      merchantId: merchant.id,
    };

    if (options.status) {
      where.status = options.status;
    }

    if (options.gateway) {
      where.gateway = options.gateway.toUpperCase();
    }

    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) {
        where.createdAt.gte = options.startDate;
      }
      if (options.endDate) {
        where.createdAt.lte = options.endDate;
      }
    }

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          attempts: {
            orderBy: { attemptNo: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: options.limit || 50,
        skip: options.offset || 0,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data: payments,
      pagination: {
        total,
        limit: options.limit || 50,
        offset: options.offset || 0,
        hasMore: (options.offset || 0) + payments.length < total,
      },
    };
  }

  private async validateMerchant(apiKey: string) {
    const apiKeyHash = hashString(apiKey);
    
    // Try cache first
    const cacheKey = CACHE_KEYS.MERCHANT(apiKeyHash);
    const cachedMerchant = await this.redis.get(cacheKey);
    
    if (cachedMerchant) {
      return JSON.parse(cachedMerchant);
    }

    const merchant = await this.prisma.merchant.findUnique({
      where: { apiKeyHash },
    });

    if (!merchant) {
      throw new PaymentError('Invalid API key', 'INVALID_API_KEY', 401);
    }

    // Cache merchant
    await this.redis.setex(
      cacheKey,
      CACHE_TTL.MERCHANT,
      JSON.stringify(merchant)
    );

    return merchant;
  }

  private async checkIdempotency(
    merchantId: string,
    idempotencyKey: string
  ) {
    const cacheKey = CACHE_KEYS.IDEMPOTENCY(idempotencyKey, merchantId);
    const cachedPaymentId = await this.redis.get(cacheKey);
    
    if (cachedPaymentId) {
      return await this.prisma.payment.findUnique({
        where: { id: cachedPaymentId },
        include: {
          attempts: {
            orderBy: { attemptNo: 'desc' },
            take: 1,
          },
        },
      });
    }

    // Check database
    const existingPayment = await this.prisma.payment.findUnique({
      where: {
        merchantId_idempotencyKey: {
          merchantId,
          idempotencyKey,
        },
      },
      include: {
        attempts: {
          orderBy: { attemptNo: 'desc' },
          take: 1,
        },
      },
    });

    if (existingPayment) {
      // Cache for future requests
      await this.cachePaymentForIdempotency(
        merchantId,
        idempotencyKey,
        existingPayment.id
      );
    }

    return existingPayment;
  }

  private async cachePaymentForIdempotency(
    merchantId: string,
    idempotencyKey: string,
    paymentId: string
  ) {
    const cacheKey = CACHE_KEYS.IDEMPOTENCY(idempotencyKey, merchantId);
    await this.redis.setex(cacheKey, CACHE_TTL.IDEMPOTENCY, paymentId);
  }

  private async processWithGateway(
    payment: any,
    attempt: any,
    correlationId: string
  ) {
    // Update attempt to processing
    await this.prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: { status: 'PROCESSING' },
    });

    // Update payment to processing
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'PROCESSING' },
    });

    try {
      // Get gateway configuration
      const gatewayConfig = this.getGatewayConfig(payment.gateway);
      const gateway = gatewayFactory.create(gatewayConfig);

      // Process payment
      const result = await gateway.createPayment({
        amount: payment.amount,
        currency: payment.currency,
        metadata: payment.metadata,
      });

      // Update payment with gateway response
      const updatedPayment = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: this.mapGatewayStatusToPaymentStatus(result.status),
          providerPaymentId: result.providerPaymentId,
        },
        include: {
          attempts: {
            orderBy: { attemptNo: 'desc' },
            take: 1,
          },
        },
      });

      // Update attempt
      await this.prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: this.mapGatewayStatusToAttemptStatus(result.status),
          providerResponse: result.raw,
        },
      });

      this.logger.info({
        correlationId,
        paymentId: payment.id,
        gatewayStatus: result.status,
        providerPaymentId: result.providerPaymentId,
      }, 'Payment processed successfully');

      return updatedPayment;
    } catch (error) {
      // Update payment and attempt with error
      await Promise.all([
        this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'FAILED' },
        }),
        this.prisma.paymentAttempt.update({
          where: { id: attempt.id },
          data: {
            status: 'FAILED',
            errorCode: error instanceof GatewayError ? error.code : 'UNKNOWN_ERROR',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          },
        }),
      ]);

      throw error;
    }
  }

  private getGatewayConfig(gateway: string): GatewayConfig {
    const gatewayLower = gateway.toLowerCase();
    
    switch (gatewayLower) {
      case 'stripe':
        return {
          name: 'stripe',
          enabled: process.env.ENABLE_STRIPE === 'true',
          testMode: true,
          credentials: {
            secretKey: process.env.STRIPE_SECRET_KEY || '',
          },
        };
      
      case 'razorpay':
        return {
          name: 'razorpay',
          enabled: process.env.ENABLE_RAZORPAY === 'true',
          testMode: true,
          credentials: {
            keyId: process.env.RAZORPAY_KEY_ID || '',
            keySecret: process.env.RAZORPAY_KEY_SECRET || '',
          },
        };
      
      case 'mock':
        return {
          name: 'mock',
          enabled: true,
          testMode: true,
          credentials: {},
          settings: {
            successRate: parseFloat(process.env.MOCK_GATEWAY_SUCCESS_RATE || '0.9'),
            averageLatencyMs: parseInt(process.env.MOCK_GATEWAY_AVERAGE_LATENCY_MS || '500'),
            enableChaos: process.env.MOCK_GATEWAY_ENABLE_CHAOS === 'true',
            chaosRate: parseFloat(process.env.MOCK_GATEWAY_CHAOS_RATE || '0.1'),
          },
        };
      
      default:
        throw new PaymentError(`Unsupported gateway: ${gateway}`, 'UNSUPPORTED_GATEWAY', 400);
    }
  }

  private mapGatewayStatusToPaymentStatus(gatewayStatus: string): 'PENDING' | 'PROCESSING' | 'REQUIRES_ACTION' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' {
    switch (gatewayStatus) {
      case 'succeeded':
        return 'SUCCEEDED';
      case 'processing':
        return 'PROCESSING';
      case 'requires_action':
        return 'REQUIRES_ACTION';
      case 'failed':
        return 'FAILED';
      default:
        return 'FAILED';
    }
  }

  private mapGatewayStatusToAttemptStatus(gatewayStatus: string): 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' {
    switch (gatewayStatus) {
      case 'succeeded':
        return 'SUCCEEDED';
      case 'processing':
      case 'requires_action':
        return 'PROCESSING';
      case 'failed':
        return 'FAILED';
      default:
        return 'FAILED';
    }
  }

  private async createOutboxEvent(
    paymentId: string,
    eventType: string,
    payload: any
  ) {
    await this.prisma.outbox.create({
      data: {
        aggregateType: 'payment',
        aggregateId: paymentId,
        eventType,
        payload,
      },
    });
  }
}
