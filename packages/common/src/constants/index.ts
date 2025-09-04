// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

// Error Codes
export const ERROR_CODES = {
  // Validation Errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_IDEMPOTENCY_KEY: 'INVALID_IDEMPOTENCY_KEY',
  DUPLICATE_IDEMPOTENCY_KEY: 'DUPLICATE_IDEMPOTENCY_KEY',
  
  // Authentication Errors
  INVALID_API_KEY: 'INVALID_API_KEY',
  UNAUTHORIZED: 'UNAUTHORIZED',
  
  // Payment Errors
  PAYMENT_NOT_FOUND: 'PAYMENT_NOT_FOUND',
  PAYMENT_ALREADY_PROCESSED: 'PAYMENT_ALREADY_PROCESSED',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  PAYMENT_DECLINED: 'PAYMENT_DECLINED',
  
  // Gateway Errors
  GATEWAY_ERROR: 'GATEWAY_ERROR',
  GATEWAY_TIMEOUT: 'GATEWAY_TIMEOUT',
  GATEWAY_UNAVAILABLE: 'GATEWAY_UNAVAILABLE',
  
  // Webhook Errors
  WEBHOOK_ENDPOINT_NOT_FOUND: 'WEBHOOK_ENDPOINT_NOT_FOUND',
  WEBHOOK_DELIVERY_FAILED: 'WEBHOOK_DELIVERY_FAILED',
  
  // System Errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  REDIS_ERROR: 'REDIS_ERROR',
} as const;

// Retry Configuration
export const RETRY_CONFIG = {
  MAX_ATTEMPTS: 5,
  INITIAL_DELAY_MS: 1000,
  MAX_DELAY_MS: 30000,
  BACKOFF_MULTIPLIER: 2,
  JITTER_FACTOR: 0.1,
} as const;

// Webhook Configuration
export const WEBHOOK_CONFIG = {
  MAX_DELIVERY_ATTEMPTS: 10,
  INITIAL_RETRY_DELAY_MS: 1000,
  MAX_RETRY_DELAY_MS: 86400000, // 24 hours
  TIMEOUT_MS: 30000,
} as const;

// Queue Names
export const QUEUE_NAMES = {
  PAYMENT_PROCESSING: 'payment:processing',
  WEBHOOK_DELIVERY: 'webhook:delivery',
  OUTBOX_PROCESSOR: 'outbox:processor',
  DEAD_LETTER: 'dead:letter',
} as const;

// Cache Keys
export const CACHE_KEYS = {
  IDEMPOTENCY: (key: string, merchantId: string) => `idempotency:${merchantId}:${key}`,
  MERCHANT: (id: string) => `merchant:${id}`,
  PAYMENT: (id: string) => `payment:${id}`,
  RATE_LIMIT: (key: string) => `rate_limit:${key}`,
} as const;

// Cache TTL (in seconds)
export const CACHE_TTL = {
  IDEMPOTENCY: 86400, // 24 hours
  MERCHANT: 3600, // 1 hour
  PAYMENT: 300, // 5 minutes
  RATE_LIMIT: 3600, // 1 hour
} as const;

// Rate Limiting
export const RATE_LIMITS = {
  API_REQUESTS_PER_MINUTE: 1000,
  WEBHOOK_DELIVERIES_PER_MINUTE: 100,
} as const;

// Supported Currencies
export const SUPPORTED_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'SEK', 'NZD',
  'INR', 'SGD', 'HKD', 'NOK', 'MXN', 'ZAR', 'BRL', 'KRW', 'RUB', 'PLN'
] as const;

// Environment Variables
export const ENV_VARS = {
  NODE_ENV: 'NODE_ENV',
  PORT: 'PORT',
  DATABASE_URL: 'DATABASE_URL',
  REDIS_URL: 'REDIS_URL',
  STRIPE_SECRET_KEY: 'STRIPE_SECRET_KEY',
  RAZORPAY_KEY_ID: 'RAZORPAY_KEY_ID',
  RAZORPAY_KEY_SECRET: 'RAZORPAY_KEY_SECRET',
  OTEL_EXPORTER_OTLP_ENDPOINT: 'OTEL_EXPORTER_OTLP_ENDPOINT',
  LOG_LEVEL: 'LOG_LEVEL',
} as const;
