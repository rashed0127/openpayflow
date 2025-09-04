import { z } from 'zod';

// Payment Status Enum
export const PaymentStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  REQUIRES_ACTION: 'requires_action',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

// Payment Attempt Status
export const PaymentAttemptStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
} as const;

export type PaymentAttemptStatus = (typeof PaymentAttemptStatus)[keyof typeof PaymentAttemptStatus];

// Webhook Delivery Status
export const WebhookDeliveryStatus = {
  PENDING: 'pending',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  ABANDONED: 'abandoned',
} as const;

export type WebhookDeliveryStatus = (typeof WebhookDeliveryStatus)[keyof typeof WebhookDeliveryStatus];

// Gateway Names
export const GatewayName = {
  STRIPE: 'stripe',
  RAZORPAY: 'razorpay',
  MOCK: 'mock',
} as const;

export type GatewayName = (typeof GatewayName)[keyof typeof GatewayName];

// Event Types
export const EventType = {
  PAYMENT_CREATED: 'payment.created',
  PAYMENT_PROCESSING: 'payment.processing',
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_CANCELLED: 'payment.cancelled',
  REFUND_CREATED: 'refund.created',
  REFUND_SUCCEEDED: 'refund.succeeded',
  REFUND_FAILED: 'refund.failed',
} as const;

export type EventType = (typeof EventType)[keyof typeof EventType];

// Zod Schemas for Validation
export const CreatePaymentSchema = z.object({
  amount: z.number().int().positive(),
  currency: z.string().length(3).toUpperCase(),
  gateway: z.enum(['stripe', 'razorpay', 'mock']),
  metadata: z.record(z.string(), z.any()).optional(),
  merchantApiKey: z.string().min(1),
});

export type CreatePaymentRequest = z.infer<typeof CreatePaymentSchema>;

export const CreateRefundSchema = z.object({
  paymentId: z.string().uuid(),
  amount: z.number().int().positive().optional(),
  reason: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  merchantApiKey: z.string().min(1),
});

export type CreateRefundRequest = z.infer<typeof CreateRefundSchema>;

export const CreateWebhookEndpointSchema = z.object({
  url: z.string().url(),
  secret: z.string().min(1),
  events: z.array(z.string()).min(1),
  merchantApiKey: z.string().min(1),
});

export type CreateWebhookEndpointRequest = z.infer<typeof CreateWebhookEndpointSchema>;

// Domain Models
export interface Merchant {
  id: string;
  name: string;
  apiKeyHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Payment {
  id: string;
  merchantId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  gateway: GatewayName;
  providerPaymentId?: string;
  idempotencyKey: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentAttempt {
  id: string;
  paymentId: string;
  attemptNo: number;
  status: PaymentAttemptStatus;
  errorCode?: string;
  errorMessage?: string;
  providerResponse?: Record<string, any>;
  createdAt: Date;
}

export interface Event {
  id: string;
  type: EventType;
  payload: Record<string, any>;
  createdAt: Date;
}

export interface WebhookEndpoint {
  id: string;
  merchantId: string;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  eventId: string;
  status: WebhookDeliveryStatus;
  attemptCount: number;
  lastError?: string;
  nextRetryAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Outbox {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, any>;
  processed: boolean;
  createdAt: Date;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Error Types
export class PaymentError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public details?: any
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

export class GatewayError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public gatewayResponse?: any
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}
