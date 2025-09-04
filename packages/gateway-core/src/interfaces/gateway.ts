import { GatewayName } from '@openpayflow/common';

export interface CreatePaymentInput {
  amount: number;
  currency: string;
  metadata?: Record<string, any>;
  customerId?: string;
  paymentMethodId?: string;
}

export interface CreatePaymentResult {
  providerPaymentId: string;
  status: 'requires_action' | 'succeeded' | 'failed' | 'processing';
  clientSecret?: string;
  nextAction?: {
    type: string;
    redirectUrl?: string;
    data?: Record<string, any>;
  };
  raw: any;
}

export interface RefundPaymentInput {
  providerPaymentId: string;
  amount?: number;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface RefundPaymentResult {
  providerRefundId: string;
  status: 'succeeded' | 'failed' | 'pending';
  raw: any;
}

export interface PaymentStatusResult {
  status: 'succeeded' | 'processing' | 'failed' | 'cancelled' | 'requires_action';
  amount?: number;
  currency?: string;
  metadata?: Record<string, any>;
  raw: any;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: Record<string, any>;
  created: number;
}

export interface Gateway {
  readonly name: GatewayName;
  
  /**
   * Create a new payment with the gateway
   */
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  
  /**
   * Refund a payment
   */
  refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult>;
  
  /**
   * Get the current status of a payment
   */
  getPaymentStatus(providerPaymentId: string): Promise<PaymentStatusResult>;
  
  /**
   * Verify and parse a webhook event from the gateway
   */
  verifyWebhook?(payload: string, signature: string, secret: string): WebhookEvent | null;
  
  /**
   * Health check for the gateway
   */
  healthCheck?(): Promise<boolean>;
}

export interface GatewayConfig {
  name: GatewayName;
  enabled: boolean;
  testMode: boolean;
  credentials: Record<string, string>;
  settings?: Record<string, any>;
}

export interface GatewayFactory {
  create(config: GatewayConfig): Gateway;
  getSupportedGateways(): GatewayName[];
}
