import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  
  // Gateway credentials
  STRIPE_SECRET_KEY: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  
  // OpenTelemetry
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default('http://localhost:4318'),
  OTEL_SERVICE_NAME: z.string().default('openpayflow-api'),
  
  // Security
  API_KEY_SALT: z.string().default('openpayflow-salt-change-in-production'),
  
  // Rate limiting
  RATE_LIMIT_MAX: z.coerce.number().default(1000),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000), // 1 minute
  
  // Webhook settings
  WEBHOOK_TIMEOUT_MS: z.coerce.number().default(30000),
  WEBHOOK_MAX_RETRIES: z.coerce.number().default(10),
  
  // Feature flags
  ENABLE_STRIPE: z.coerce.boolean().default(false),
  ENABLE_RAZORPAY: z.coerce.boolean().default(false),
  ENABLE_MOCK: z.coerce.boolean().default(true),
  ENABLE_GRAPHQL: z.coerce.boolean().default(true),
});

export type Config = z.infer<typeof configSchema>;

let config: Config;

try {
  config = configSchema.parse(process.env);
} catch (error) {
  console.error('Configuration validation failed:', error);
  process.exit(1);
}

export { config };
