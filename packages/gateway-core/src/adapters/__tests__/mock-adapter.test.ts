import { MockAdapter } from '../mock-adapter';

describe('MockAdapter', () => {
  let mockAdapter: MockAdapter;

  beforeEach(() => {
    mockAdapter = new MockAdapter({
      name: 'mock',
      enabled: true,
      testMode: true,
      credentials: {},
      settings: {
        successRate: 0.9,
        averageLatencyMs: 100,
        enableChaos: false,
        chaosRate: 0.1,
      },
    });
  });

  describe('createPayment', () => {
    it('should create a successful payment', async () => {
      // Mock Math.random to return a value that will trigger success
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const result = await mockAdapter.createPayment({
        amount: 1000,
        currency: 'USD',
        metadata: { orderId: 'test_001' },
      });

      expect(result.status).toBe('succeeded');
      expect(result.providerPaymentId).toMatch(/^mock_pi_/);
      expect(result.raw.amount).toBe(1000);
      expect(result.raw.currency).toBe('USD');

      Math.random = jest.fn().mockRestore();
    });

    it('should create a failed payment when random value exceeds success rate', async () => {
      // Mock Math.random to return a value that will trigger failure
      jest.spyOn(Math, 'random').mockReturnValue(0.95);

      const result = await mockAdapter.createPayment({
        amount: 1000,
        currency: 'USD',
      });

      expect(result.status).toBe('failed');
      expect(result.providerPaymentId).toMatch(/^mock_pi_/);

      Math.random = jest.fn().mockRestore();
    });

    it('should create a payment requiring action when chaos is enabled', async () => {
      const chaosAdapter = new MockAdapter({
        name: 'mock',
        enabled: true,
        testMode: true,
        credentials: {},
        settings: {
          successRate: 1.0,
          averageLatencyMs: 100,
          enableChaos: true,
          chaosRate: 1.0, // Always trigger chaos
        },
      });

      // Mock Math.random to always trigger requires_action
      jest.spyOn(Math, 'random')
        .mockReturnValueOnce(0.5) // First call for chaos check
        .mockReturnValueOnce(0.3); // Second call for chaos type (< 0.4 = requires_action)

      const result = await chaosAdapter.createPayment({
        amount: 1000,
        currency: 'USD',
      });

      expect(result.status).toBe('requires_action');
      expect(result.nextAction).toBeDefined();
      expect(result.nextAction?.type).toBe('redirect_to_url');

      Math.random = jest.fn().mockRestore();
    });

    it('should simulate latency', async () => {
      const startTime = Date.now();
      
      await mockAdapter.createPayment({
        amount: 1000,
        currency: 'USD',
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should take at least some time due to simulated latency
      // Using a small threshold to account for test environment variations
      expect(duration).toBeGreaterThan(50);
    });
  });

  describe('refundPayment', () => {
    it('should create a successful refund', async () => {
      // Mock Math.random to return a value that will trigger success
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const result = await mockAdapter.refundPayment({
        providerPaymentId: 'mock_pi_test123',
        amount: 500,
      });

      expect(result.status).toBe('succeeded');
      expect(result.raw.refundId).toMatch(/^mock_re_/);
      expect(result.raw.amount).toBe(500);

      Math.random = jest.fn().mockRestore();
    });

    it('should create a failed refund when random value exceeds success rate', async () => {
      // Mock Math.random to return a value that will trigger failure
      jest.spyOn(Math, 'random').mockReturnValue(0.95);

      const result = await mockAdapter.refundPayment({
        providerPaymentId: 'mock_pi_test123',
        amount: 500,
      });

      expect(result.status).toBe('failed');

      Math.random = jest.fn().mockRestore();
    });
  });

  describe('getPaymentStatus', () => {
    it('should return payment status', async () => {
      // Mock Math.random to return a value that will trigger success
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const result = await mockAdapter.getPaymentStatus('mock_pi_test123');

      expect(result.status).toBe('succeeded');
      expect(result.providerPaymentId).toBe('mock_pi_test123');
      expect(result.amount).toBeDefined();
      expect(result.currency).toBeDefined();

      Math.random = jest.fn().mockRestore();
    });

    it('should return failed status when random value exceeds success rate', async () => {
      // Mock Math.random to return a value that will trigger failure
      jest.spyOn(Math, 'random').mockReturnValue(0.95);

      const result = await mockAdapter.getPaymentStatus('mock_pi_test123');

      expect(result.status).toBe('failed');

      Math.random = jest.fn().mockRestore();
    });
  });

  describe('configuration validation', () => {
    it('should handle missing settings gracefully', () => {
      const adapterWithoutSettings = new MockAdapter({
        name: 'mock',
        enabled: true,
        testMode: true,
        credentials: {},
      });

      expect(adapterWithoutSettings).toBeDefined();
    });

    it('should use default values for missing settings', async () => {
      const adapterWithPartialSettings = new MockAdapter({
        name: 'mock',
        enabled: true,
        testMode: true,
        credentials: {},
        settings: {
          successRate: 0.5,
          // Missing other settings
        },
      });

      // Should not throw error
      const result = await adapterWithPartialSettings.createPayment({
        amount: 1000,
        currency: 'USD',
      });

      expect(result).toBeDefined();
    });
  });

  describe('error scenarios', () => {
    it('should handle extremely low success rate', async () => {
      const lowSuccessAdapter = new MockAdapter({
        name: 'mock',
        enabled: true,
        testMode: true,
        credentials: {},
        settings: {
          successRate: 0.01, // 1% success rate
          averageLatencyMs: 10,
          enableChaos: false,
          chaosRate: 0,
        },
      });

      // Mock Math.random to return a high value (failure)
      jest.spyOn(Math, 'random').mockReturnValue(0.99);

      const result = await lowSuccessAdapter.createPayment({
        amount: 1000,
        currency: 'USD',
      });

      expect(result.status).toBe('failed');

      Math.random = jest.fn().mockRestore();
    });

    it('should handle zero latency', async () => {
      const zeroLatencyAdapter = new MockAdapter({
        name: 'mock',
        enabled: true,
        testMode: true,
        credentials: {},
        settings: {
          successRate: 1.0,
          averageLatencyMs: 0,
          enableChaos: false,
          chaosRate: 0,
        },
      });

      const startTime = Date.now();
      
      await zeroLatencyAdapter.createPayment({
        amount: 1000,
        currency: 'USD',
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete very quickly
      expect(duration).toBeLessThan(50);
    });
  });
});
