import Razorpay from 'razorpay';
import crypto from 'crypto';
import { GatewayName, GatewayError } from '@openpayflow/common';
import {
  Gateway,
  CreatePaymentInput,
  CreatePaymentResult,
  RefundPaymentInput,
  RefundPaymentResult,
  PaymentStatusResult,
  WebhookEvent,
} from '../interfaces/gateway';

export class RazorpayAdapter implements Gateway {
  readonly name: GatewayName = 'razorpay';
  private razorpay: Razorpay;

  constructor(keyId: string, keySecret: string, testMode = true) {
    if (!keyId || !keySecret) {
      throw new Error('Razorpay key ID and secret are required');
    }

    // Ensure we're in test mode for safety
    if (!testMode && !keyId.startsWith('rzp_test_')) {
      throw new Error('Only test keys are allowed in this sandbox environment');
    }

    this.razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    try {
      // Razorpay uses orders, so we create an order first
      const order = await this.razorpay.orders.create({
        amount: input.amount,
        currency: input.currency.toUpperCase(),
        notes: input.metadata || {},
      });

      // In Razorpay, orders are created but not immediately processed
      // The actual payment happens on the frontend with the order ID
      return {
        providerPaymentId: order.id,
        status: 'requires_action', // Razorpay orders always require frontend action
        clientSecret: order.id, // Use order ID as client secret
        nextAction: {
          type: 'razorpay_checkout',
          data: {
            order_id: order.id,
            amount: order.amount,
            currency: order.currency,
          },
        },
        raw: order,
      };
    } catch (error: any) {
      throw new GatewayError(
        error.description || 'Razorpay payment creation failed',
        error.code || 'razorpay_error',
        error.statusCode || 500,
        error
      );
    }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    try {
      const refund = await this.razorpay.payments.refund(input.providerPaymentId, {
        amount: input.amount,
        notes: input.metadata || {},
      });

      let status: RefundPaymentResult['status'];
      switch (refund.status) {
        case 'processed':
          status = 'succeeded';
          break;
        case 'pending':
          status = 'pending';
          break;
        default:
          status = 'failed';
      }

      return {
        providerRefundId: refund.id,
        status,
        raw: refund,
      };
    } catch (error: any) {
      throw new GatewayError(
        error.description || 'Razorpay refund creation failed',
        error.code || 'razorpay_refund_error',
        error.statusCode || 500,
        error
      );
    }
  }

  async getPaymentStatus(providerPaymentId: string): Promise<PaymentStatusResult> {
    try {
      // Check if it's an order ID or payment ID
      let payment;
      if (providerPaymentId.startsWith('order_')) {
        // It's an order ID, fetch payments for this order
        const payments = await this.razorpay.orders.fetchPayments(providerPaymentId);
        if (payments.items && payments.items.length > 0) {
          payment = payments.items[0]; // Get the latest payment
        } else {
          // Order exists but no payments yet
          const order = await this.razorpay.orders.fetch(providerPaymentId);
          return {
            status: 'requires_action',
            amount: typeof order.amount === 'string' ? parseInt(order.amount) : order.amount,
            currency: order.currency,
            metadata: order.notes,
            raw: order,
          };
        }
      } else {
        // It's a payment ID
        payment = await this.razorpay.payments.fetch(providerPaymentId);
      }

      if (!payment) {
        throw new Error('Payment not found');
      }

      let status: PaymentStatusResult['status'];
      switch (payment.status) {
        case 'captured':
        case 'authorized':
          status = 'succeeded';
          break;
        case 'failed':
          status = 'failed';
          break;
        case 'created':
          status = 'processing';
          break;
        default:
          status = 'processing';
      }

      return {
        status,
        amount: typeof payment.amount === 'string' ? parseInt(payment.amount) : payment.amount,
        currency: payment.currency,
        metadata: payment.notes,
        raw: payment,
      };
    } catch (error: any) {
      throw new GatewayError(
        error.description || 'Failed to get Razorpay payment status',
        error.code || 'razorpay_status_error',
        error.statusCode || 500,
        error
      );
    }
  }

  verifyWebhook(payload: string, signature: string, secret: string): WebhookEvent | null {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      if (signature !== expectedSignature) {
        return null;
      }

      const event = JSON.parse(payload);
      
      return {
        id: event.event,
        type: event.event,
        data: event.payload,
        created: Math.floor(Date.now() / 1000),
      };
    } catch (error) {
      console.error('Razorpay webhook verification failed:', error);
      return null;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Try to fetch orders to verify connectivity
      await this.razorpay.orders.all({ count: 1 });
      return true;
    } catch (error) {
      console.error('Razorpay health check failed:', error);
      return false;
    }
  }
}
