import crypto from 'crypto';
import { GatewayName, GatewayError, generateSecureId } from '@openpayflow/common';
import {
  Gateway,
  CreatePaymentInput,
  CreatePaymentResult,
  RefundPaymentInput,
  RefundPaymentResult,
  PaymentStatusResult,
  WebhookEvent,
} from '../interfaces/gateway';

export interface MockGatewayConfig {
  successRate?: number; // 0-1, default 0.9
  averageLatencyMs?: number; // default 500
  enableChaos?: boolean; // default false
  chaosRate?: number; // 0-1, default 0.1
}

export class MockAdapter implements Gateway {
  readonly name: GatewayName = 'mock';
  private config: Required<MockGatewayConfig>;
  private payments: Map<string, any> = new Map();
  private refunds: Map<string, any> = new Map();

  constructor(config: MockGatewayConfig = {}) {
    this.config = {
      successRate: config.successRate ?? 0.9,
      averageLatencyMs: config.averageLatencyMs ?? 500,
      enableChaos: config.enableChaos ?? false,
      chaosRate: config.chaosRate ?? 0.1,
    };
  }

  private async simulateLatency(): Promise<void> {
    // Add some random latency to simulate real gateway behavior
    const latency = this.config.averageLatencyMs + (Math.random() - 0.5) * 200;
    await new Promise(resolve => setTimeout(resolve, Math.max(100, latency)));
  }

  private shouldFail(): boolean {
    if (this.config.enableChaos && Math.random() < this.config.chaosRate) {
      return true;
    }
    return Math.random() > this.config.successRate;
  }

  private generateMockError(): GatewayError {
    const errors = [
      { code: 'card_declined', message: 'Your card was declined.', statusCode: 402 },
      { code: 'insufficient_funds', message: 'Insufficient funds.', statusCode: 402 },
      { code: 'expired_card', message: 'Your card has expired.', statusCode: 402 },
      { code: 'processing_error', message: 'An error occurred while processing your card.', statusCode: 500 },
      { code: 'network_error', message: 'Network error occurred.', statusCode: 503 },
    ];

    const error = errors[Math.floor(Math.random() * errors.length)];
    return new GatewayError(error.message, error.code, error.statusCode);
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    await this.simulateLatency();

    const paymentId = `mock_pi_${generateSecureId(16)}`;

    if (this.shouldFail()) {
      const payment = {
        id: paymentId,
        status: 'failed',
        amount: input.amount,
        currency: input.currency,
        metadata: input.metadata,
        created: Date.now(),
      };
      this.payments.set(paymentId, payment);
      throw this.generateMockError();
    }

    // Simulate different payment flows
    const rand = Math.random();
    let status: CreatePaymentResult['status'];
    let nextAction: CreatePaymentResult['nextAction'];

    if (rand < 0.7) {
      // 70% succeed immediately
      status = 'succeeded';
    } else if (rand < 0.9) {
      // 20% require action (3D Secure simulation)
      status = 'requires_action';
      nextAction = {
        type: 'redirect_to_url',
        redirectUrl: `http://localhost:3000/mock-3ds?payment_id=${paymentId}`,
        data: {
          payment_id: paymentId,
          return_url: 'http://localhost:3000/payments/return',
        },
      };
    } else {
      // 10% are processing
      status = 'processing';
    }

    const payment = {
      id: paymentId,
      status,
      amount: input.amount,
      currency: input.currency,
      metadata: input.metadata || {},
      created: Date.now(),
      client_secret: `${paymentId}_secret_${generateSecureId(8)}`,
    };

    this.payments.set(paymentId, payment);

    return {
      providerPaymentId: paymentId,
      status,
      clientSecret: payment.client_secret,
      nextAction,
      raw: payment,
    };
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    await this.simulateLatency();

    const payment = this.payments.get(input.providerPaymentId);
    if (!payment) {
      throw new GatewayError('Payment not found', 'payment_not_found', 404);
    }

    if (payment.status !== 'succeeded') {
      throw new GatewayError('Payment cannot be refunded', 'payment_not_refundable', 400);
    }

    const refundId = `mock_re_${generateSecureId(16)}`;

    if (this.shouldFail()) {
      throw this.generateMockError();
    }

    const refundAmount = input.amount || payment.amount;
    if (refundAmount > payment.amount) {
      throw new GatewayError('Refund amount exceeds payment amount', 'amount_too_large', 400);
    }

    const refund = {
      id: refundId,
      payment_id: input.providerPaymentId,
      amount: refundAmount,
      status: 'succeeded',
      reason: input.reason || 'requested_by_customer',
      metadata: input.metadata || {},
      created: Date.now(),
    };

    this.refunds.set(refundId, refund);

    return {
      providerRefundId: refundId,
      status: 'succeeded',
      raw: refund,
    };
  }

  async getPaymentStatus(providerPaymentId: string): Promise<PaymentStatusResult> {
    await this.simulateLatency();

    const payment = this.payments.get(providerPaymentId);
    if (!payment) {
      throw new GatewayError('Payment not found', 'payment_not_found', 404);
    }

    // Simulate status transitions for processing payments
    if (payment.status === 'processing') {
      const now = Date.now();
      const elapsed = now - payment.created;
      
      // After 30 seconds, randomly succeed or fail
      if (elapsed > 30000) {
        payment.status = Math.random() < 0.8 ? 'succeeded' : 'failed';
        this.payments.set(providerPaymentId, payment);
      }
    }

    let status: PaymentStatusResult['status'];
    switch (payment.status) {
      case 'succeeded':
        status = 'succeeded';
        break;
      case 'processing':
        status = 'processing';
        break;
      case 'requires_action':
        status = 'requires_action';
        break;
      case 'cancelled':
        status = 'cancelled';
        break;
      default:
        status = 'failed';
    }

    return {
      status,
      amount: payment.amount,
      currency: payment.currency,
      metadata: payment.metadata,
      raw: payment,
    };
  }

  verifyWebhook(payload: string, signature: string, secret: string): WebhookEvent | null {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      // Simple signature verification for mock
      if (`sha256=${expectedSignature}` !== signature) {
        return null;
      }

      const event = JSON.parse(payload);
      
      return {
        id: event.id || `mock_evt_${generateSecureId(16)}`,
        type: event.type,
        data: event.data,
        created: event.created || Math.floor(Date.now() / 1000),
      };
    } catch (error) {
      console.error('Mock webhook verification failed:', error);
      return null;
    }
  }

  async healthCheck(): Promise<boolean> {
    await this.simulateLatency();
    
    // Occasionally fail health check if chaos is enabled
    if (this.config.enableChaos && Math.random() < this.config.chaosRate / 2) {
      return false;
    }
    
    return true;
  }

  // Mock-specific methods for testing
  getPayment(paymentId: string) {
    return this.payments.get(paymentId);
  }

  getRefund(refundId: string) {
    return this.refunds.get(refundId);
  }

  getAllPayments() {
    return Array.from(this.payments.values());
  }

  getAllRefunds() {
    return Array.from(this.refunds.values());
  }

  clearAll() {
    this.payments.clear();
    this.refunds.clear();
  }

  updateConfig(config: Partial<MockGatewayConfig>) {
    this.config = { ...this.config, ...config };
  }
}
