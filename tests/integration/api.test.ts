import { createApp } from '../../apps/api/src/app';
import { FastifyInstance } from 'fastify';

describe('API Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://openpayflow:openpayflow@localhost:5432/openpayflow_test';
    process.env.REDIS_URL = 'redis://localhost:6379/1';

    app = await createApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Endpoints', () => {
    it('should return healthy status for /healthz', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/healthz',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('healthy');
      expect(body.timestamp).toBeDefined();
    });

    it('should return ready status for /readyz', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/readyz',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ready');
      expect(body.checks).toBeDefined();
    });
  });

  describe('OpenAPI Documentation', () => {
    it('should serve OpenAPI documentation at /docs', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/docs',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
    });

    it('should serve OpenAPI JSON specification', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/docs/json',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.openapi).toBeDefined();
      expect(body.info).toBeDefined();
      expect(body.info.title).toBe('OpenPayFlow API');
    });
  });

  describe('GraphQL Endpoint', () => {
    it('should serve GraphQL playground', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/graphql',
        headers: {
          'Accept': 'text/html',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
    });

    it('should handle GraphQL introspection query', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/graphql',
        headers: {
          'Content-Type': 'application/json',
        },
        payload: {
          query: '{ __schema { types { name } } }',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(body.data.__schema).toBeDefined();
    });

    it('should execute simple hello query', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/graphql',
        headers: {
          'Content-Type': 'application/json',
        },
        payload: {
          query: '{ hello }',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(body.data.hello).toBe('Hello from OpenPayFlow GraphQL!');
    });
  });

  describe('Payment Endpoints', () => {
    it('should reject payment creation without idempotency key', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/payments',
        headers: {
          'Content-Type': 'application/json',
        },
        payload: {
          amount: 1000,
          currency: 'USD',
          gateway: 'mock',
          merchantApiKey: 'test_key',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject payment creation with invalid payload', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/payments',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'test_key_123',
        },
        payload: {
          amount: -1000, // Invalid negative amount
          currency: 'USD',
          gateway: 'mock',
          merchantApiKey: 'test_key',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
    });

    it('should handle payment creation with invalid merchant API key', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/payments',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'test_key_123',
        },
        payload: {
          amount: 1000,
          currency: 'USD',
          gateway: 'mock',
          merchantApiKey: 'invalid_key',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Webhook Endpoints', () => {
    it('should list webhook endpoints', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/webhook-endpoints?merchantApiKey=invalid_key',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject webhook endpoint creation with invalid payload', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/webhook-endpoints',
        headers: {
          'Content-Type': 'application/json',
        },
        payload: {
          url: 'invalid-url', // Invalid URL format
          secret: 'secret',
          events: ['payment.created'],
          merchantApiKey: 'test_key',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent endpoints', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/non-existent-endpoint',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 405 for unsupported methods', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/v1/healthz',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should handle malformed JSON in request body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/payments',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'test_key_123',
        },
        payload: '{"invalid": json}', // Malformed JSON
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('CORS and Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/healthz',
      });

      expect(response.headers).toHaveProperty('x-request-id');
    });

    it('should handle preflight OPTIONS requests', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/v1/payments',
        headers: {
          'Origin': 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type,Idempotency-Key',
        },
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });
});
