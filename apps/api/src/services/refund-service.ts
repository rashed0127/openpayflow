import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';
import {
  CreateRefundRequest,
  PaymentError,
  GatewayError,
  PaymentStatus,
  generateSecureId,
  hashString,
} from '@openpayflow/common';
import { gatewayFactory, GatewayConfig } from '@openpayflow/gateway-core';

export class RefundService {
  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
    private logger: Logger
  ) {}

  async createRefund(request: CreateRefundRequest) {
    const correlationId = generateSecureId(8);
    
    this.logger.info({
      correlationId,
      paymentId: request.paymentId,
      amount: request.amount,
      reason: request.reason,
    }, 'Creating refund');

    // Validate merchant
    const merchant = await this.validateMerchant(request.merchantApiKey);
    
    // Get payment
    const payment = await this.prisma.payment.findFirst({
      where: {
        id: request.paymentId,
        merchantId: merchant.id,
      },
    });

    if (!payment) {
      throw new PaymentError('Payment not found', 'PAYMENT_NOT_FOUND', 404);
    }

    if (payment.status !== 'SUCCEEDED') {
      throw new PaymentError(
        'Payment must be succeeded to create a refund',
        'PAYMENT_NOT_REFUNDABLE',
        400
      );
    }

    // Check refund amount
    const refundAmount = request.amount || payment.amount;
    
    // Get existing refunds to check total refunded amount
    const existingRefunds = await this.prisma.refund.findMany({
      where: {
        paymentId: payment.id,
        status: 'SUCCEEDED',
      },
    });

    const totalRefunded = existingRefunds.reduce((sum, refund) => sum + refund.amount, 0);
    
    if (totalRefunded + refundAmount > payment.amount) {
      throw new PaymentError(
        'Refund amount exceeds remaining refundable amount',
        'REFUND_AMOUNT_EXCEEDS_PAYMENT',
        400
      );
    }

    // Create refund record
    const refund = await this.prisma.refund.create({
      data: {
        paymentId: payment.id,
        amount: refundAmount,
        reason: request.reason,
        status: 'PENDING',
        metadata: request.metadata || {},
      },
    });

    try {
      // Process with gateway
      const result = await this.processWithGateway(payment, refund, correlationId);
      
      // Create outbox event
      await this.createOutboxEvent(refund.id, 'refund.created', {
        refund: result,
        payment,
        correlationId,
      });

      return result;
          } catch (error) {
        this.logger.error({
          correlationId,
          refundId: refund.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        }, 'Refund processing failed');
      
      throw error;
    }
  }

  private async validateMerchant(apiKey: string) {
    const apiKeyHash = hashString(apiKey);
    
    const merchant = await this.prisma.merchant.findUnique({
      where: { apiKeyHash },
    });

    if (!merchant) {
      throw new PaymentError('Invalid API key', 'INVALID_API_KEY', 401);
    }

    return merchant;
  }

  private async processWithGateway(payment: any, refund: any, correlationId: string) {
    // Update refund to processing
    await this.prisma.refund.update({
      where: { id: refund.id },
      data: { status: 'PROCESSING' },
    });

    try {
      // Get gateway configuration
      const gatewayConfig = this.getGatewayConfig(payment.gateway);
      const gateway = gatewayFactory.create(gatewayConfig);

      // Process refund
      const result = await gateway.refundPayment({
        providerPaymentId: payment.providerPaymentId,
        amount: refund.amount,
        reason: refund.reason,
        metadata: refund.metadata,
      });

      // Update refund with gateway response
      const updatedRefund = await this.prisma.refund.update({
        where: { id: refund.id },
        data: {
          status: this.mapGatewayStatusToRefundStatus(result.status),
          providerRefundId: result.providerRefundId,
        },
      });

      this.logger.info({
        correlationId,
        refundId: refund.id,
        gatewayStatus: result.status,
        providerRefundId: result.providerRefundId,
      }, 'Refund processed successfully');

      return updatedRefund;
    } catch (error) {
      // Update refund with error
      await this.prisma.refund.update({
        where: { id: refund.id },
        data: { status: 'FAILED' },
      });

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

  private mapGatewayStatusToRefundStatus(gatewayStatus: string): 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' {
    switch (gatewayStatus) {
      case 'succeeded':
        return 'SUCCEEDED';
      case 'pending':
        return 'PROCESSING';
      case 'failed':
        return 'FAILED';
      default:
        return 'FAILED';
    }
  }

  private async createOutboxEvent(
    refundId: string,
    eventType: string,
    payload: any
  ) {
    await this.prisma.outbox.create({
      data: {
        aggregateType: 'refund',
        aggregateId: refundId,
        eventType,
        payload,
      },
    });
  }
}
