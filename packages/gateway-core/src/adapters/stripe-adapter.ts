import Stripe from 'stripe';
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

export class StripeAdapter implements Gateway {
  readonly name: GatewayName = 'stripe';
  private stripe: Stripe;

  constructor(secretKey: string, testMode = true) {
    if (!secretKey) {
      throw new Error('Stripe secret key is required');
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2023-10-16',
      typescript: true,
    });

    // Ensure we're in test mode for safety
    if (!testMode && !secretKey.startsWith('sk_test_')) {
      throw new Error('Only test keys are allowed in this sandbox environment');
    }
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: input.amount,
        currency: input.currency.toLowerCase(),
        metadata: input.metadata || {},
        customer: input.customerId,
        payment_method: input.paymentMethodId,
        confirmation_method: 'manual',
        confirm: true,
        return_url: 'http://localhost:3000/payments/return',
      });

      let status: CreatePaymentResult['status'];
      switch (paymentIntent.status) {
        case 'succeeded':
          status = 'succeeded';
          break;
        case 'requires_action':
        case 'requires_confirmation':
        case 'requires_payment_method':
          status = 'requires_action';
          break;
        case 'processing':
          status = 'processing';
          break;
        default:
          status = 'failed';
      }

      const result: CreatePaymentResult = {
        providerPaymentId: paymentIntent.id,
        status,
        clientSecret: paymentIntent.client_secret || undefined,
        raw: paymentIntent,
      };

      if (paymentIntent.next_action) {
        result.nextAction = {
          type: paymentIntent.next_action.type,
          redirectUrl: paymentIntent.next_action.redirect_to_url?.url || undefined,
          data: paymentIntent.next_action,
        };
      }

      return result;
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError) {
        throw new GatewayError(
          error.message,
          error.code || 'stripe_error',
          error.statusCode || 500,
          error
        );
      }
      throw new GatewayError(
        'Stripe payment creation failed',
        'stripe_error',
        500,
        error
      );
    }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: input.providerPaymentId,
        amount: input.amount,
        reason: input.reason as Stripe.RefundCreateParams.Reason,
        metadata: input.metadata || {},
      });

      let status: RefundPaymentResult['status'];
      switch (refund.status) {
        case 'succeeded':
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
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError) {
        throw new GatewayError(
          error.message,
          error.code || 'stripe_refund_error',
          error.statusCode || 500,
          error
        );
      }
      throw new GatewayError(
        'Stripe refund creation failed',
        'stripe_refund_error',
        500,
        error
      );
    }
  }

  async getPaymentStatus(providerPaymentId: string): Promise<PaymentStatusResult> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(providerPaymentId);

      let status: PaymentStatusResult['status'];
      switch (paymentIntent.status) {
        case 'succeeded':
          status = 'succeeded';
          break;
        case 'processing':
          status = 'processing';
          break;
        case 'requires_action':
        case 'requires_confirmation':
        case 'requires_payment_method':
          status = 'requires_action';
          break;
        case 'canceled':
          status = 'cancelled';
          break;
        default:
          status = 'failed';
      }

      return {
        status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency.toUpperCase(),
        metadata: paymentIntent.metadata,
        raw: paymentIntent,
      };
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError) {
        throw new GatewayError(
          error.message,
          error.code || 'stripe_status_error',
          error.statusCode || 500,
          error
        );
      }
      throw new GatewayError(
        'Failed to get Stripe payment status',
        'stripe_status_error',
        500,
        error
      );
    }
  }

  verifyWebhook(payload: string, signature: string, secret: string): WebhookEvent | null {
    try {
      const event = this.stripe.webhooks.constructEvent(payload, signature, secret);
      
      return {
        id: event.id,
        type: event.type,
        data: event.data,
        created: event.created,
      };
    } catch (error) {
      console.error('Stripe webhook verification failed:', error);
      return null;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Try to list a small number of payment intents to verify connectivity
      await this.stripe.paymentIntents.list({ limit: 1 });
      return true;
    } catch (error) {
      console.error('Stripe health check failed:', error);
      return false;
    }
  }
}
