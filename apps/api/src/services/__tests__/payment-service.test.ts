import { PaymentService } from '../payment-service';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { Logger } from 'pino';
import { PaymentError } from '@openpayflow/common';

// Mock dependencies
const mockPrisma = {
  merchant: {
    findUnique: jest.fn(),
  },
  payment: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
  },
  paymentAttempt: {
    create: jest.fn(),
    update: jest.fn(),
  },
  outbox: {
    create: jest.fn(),
  },
} as unknown as PrismaClient;

const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
} as unknown as Redis;

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} as unknown as Logger;

describe('PaymentService', () => {
  let paymentService: PaymentService;

  beforeEach(() => {
    paymentService = new PaymentService(mockPrisma, mockRedis, mockLogger);
    jest.clearAllMocks();
  });

  describe('validateMerchant', () => {
    it('should return merchant when valid API key is provided', async () => {
      const mockMerchant = { id: 'merchant_1', name: 'Test Merchant' };
      (mockPrisma.merchant.findUnique as jest.Mock).mockResolvedValue(mockMerchant);
      (mockRedis.get as jest.Mock).mockResolvedValue(null);

      const result = await (paymentService as any).validateMerchant('valid_api_key');

      expect(result).toEqual(mockMerchant);
      expect(mockPrisma.merchant.findUnique).toHaveBeenCalled();
    });

    it('should throw PaymentError when invalid API key is provided', async () => {
      (mockPrisma.merchant.findUnique as jest.Mock).mockResolvedValue(null);
      (mockRedis.get as jest.Mock).mockResolvedValue(null);

      await expect((paymentService as any).validateMerchant('invalid_api_key'))
        .rejects.toThrow(PaymentError);
    });

    it('should return cached merchant when available', async () => {
      const mockMerchant = { id: 'merchant_1', name: 'Test Merchant' };
      (mockRedis.get as jest.Mock).mockResolvedValue(JSON.stringify(mockMerchant));

      const result = await (paymentService as any).validateMerchant('valid_api_key');

      expect(result).toEqual(mockMerchant);
      expect(mockPrisma.merchant.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('checkIdempotency', () => {
    it('should return null when no existing payment found', async () => {
      (mockRedis.get as jest.Mock).mockResolvedValue(null);
      (mockPrisma.payment.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await (paymentService as any).checkIdempotency('merchant_1', 'idem_key');

      expect(result).toBeNull();
    });

    it('should return cached payment when available', async () => {
      const mockPayment = { id: 'payment_1', amount: 1000 };
      (mockRedis.get as jest.Mock).mockResolvedValue('payment_1');
      (mockPrisma.payment.findUnique as jest.Mock).mockResolvedValue(mockPayment);

      const result = await (paymentService as any).checkIdempotency('merchant_1', 'idem_key');

      expect(result).toEqual(mockPayment);
    });

    it('should cache payment when found in database', async () => {
      const mockPayment = { id: 'payment_1', amount: 1000 };
      (mockRedis.get as jest.Mock).mockResolvedValue(null);
      (mockPrisma.payment.findUnique as jest.Mock).mockResolvedValue(mockPayment);

      const result = await (paymentService as any).checkIdempotency('merchant_1', 'idem_key');

      expect(result).toEqual(mockPayment);
      expect(mockRedis.setex).toHaveBeenCalled();
    });
  });

  describe('mapGatewayStatusToPaymentStatus', () => {
    it('should map gateway statuses correctly', () => {
      expect((paymentService as any).mapGatewayStatusToPaymentStatus('succeeded')).toBe('SUCCEEDED');
      expect((paymentService as any).mapGatewayStatusToPaymentStatus('processing')).toBe('PROCESSING');
      expect((paymentService as any).mapGatewayStatusToPaymentStatus('requires_action')).toBe('REQUIRES_ACTION');
      expect((paymentService as any).mapGatewayStatusToPaymentStatus('failed')).toBe('FAILED');
      expect((paymentService as any).mapGatewayStatusToPaymentStatus('unknown')).toBe('FAILED');
    });
  });

  describe('mapGatewayStatusToAttemptStatus', () => {
    it('should map gateway statuses correctly', () => {
      expect((paymentService as any).mapGatewayStatusToAttemptStatus('succeeded')).toBe('SUCCEEDED');
      expect((paymentService as any).mapGatewayStatusToAttemptStatus('processing')).toBe('PROCESSING');
      expect((paymentService as any).mapGatewayStatusToAttemptStatus('requires_action')).toBe('PROCESSING');
      expect((paymentService as any).mapGatewayStatusToAttemptStatus('failed')).toBe('FAILED');
      expect((paymentService as any).mapGatewayStatusToAttemptStatus('unknown')).toBe('FAILED');
    });
  });

  describe('getGatewayConfig', () => {
    it('should return mock gateway config', () => {
      const config = (paymentService as any).getGatewayConfig('mock');
      
      expect(config.name).toBe('mock');
      expect(config.enabled).toBe(true);
      expect(config.testMode).toBe(true);
    });

    it('should throw error for unsupported gateway', () => {
      expect(() => (paymentService as any).getGatewayConfig('unsupported'))
        .toThrow(PaymentError);
    });
  });

  describe('listPayments', () => {
    it('should return paginated payments', async () => {
      const mockMerchant = { id: 'merchant_1', name: 'Test Merchant' };
      const mockPayments = [
        { id: 'payment_1', amount: 1000, status: 'SUCCEEDED' },
        { id: 'payment_2', amount: 2000, status: 'FAILED' },
      ];

      (mockPrisma.merchant.findUnique as jest.Mock).mockResolvedValue(mockMerchant);
      (mockRedis.get as jest.Mock).mockResolvedValue(null);
      (mockPrisma.payment.findMany as jest.Mock).mockResolvedValue(mockPayments);
      (mockPrisma.payment.count as jest.Mock).mockResolvedValue(2);

      const result = await paymentService.listPayments('valid_api_key', {
        limit: 10,
        offset: 0,
      });

      expect(result.data).toEqual(mockPayments);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.offset).toBe(0);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('should apply status filter when provided', async () => {
      const mockMerchant = { id: 'merchant_1', name: 'Test Merchant' };
      
      (mockPrisma.merchant.findUnique as jest.Mock).mockResolvedValue(mockMerchant);
      (mockRedis.get as jest.Mock).mockResolvedValue(null);
      (mockPrisma.payment.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.payment.count as jest.Mock).mockResolvedValue(0);

      await paymentService.listPayments('valid_api_key', {
        status: 'SUCCEEDED' as any,
      });

      expect(mockPrisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'SUCCEEDED',
          }),
        })
      );
    });
  });

  describe('getPayment', () => {
    it('should return payment when found', async () => {
      const mockMerchant = { id: 'merchant_1', name: 'Test Merchant' };
      const mockPayment = { 
        id: 'payment_1', 
        amount: 1000, 
        merchantId: 'merchant_1',
        attempts: [],
        refunds: [],
      };

      (mockPrisma.merchant.findUnique as jest.Mock).mockResolvedValue(mockMerchant);
      (mockRedis.get as jest.Mock).mockResolvedValue(null);
      (mockPrisma.payment.findFirst as jest.Mock).mockResolvedValue(mockPayment);

      const result = await paymentService.getPayment('payment_1', 'valid_api_key');

      expect(result).toEqual(mockPayment);
      expect(mockPrisma.payment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'payment_1',
            merchantId: 'merchant_1',
          },
        })
      );
    });

    it('should throw PaymentError when payment not found', async () => {
      const mockMerchant = { id: 'merchant_1', name: 'Test Merchant' };

      (mockPrisma.merchant.findUnique as jest.Mock).mockResolvedValue(mockMerchant);
      (mockRedis.get as jest.Mock).mockResolvedValue(null);
      (mockPrisma.payment.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(paymentService.getPayment('payment_1', 'valid_api_key'))
        .rejects.toThrow(PaymentError);
    });
  });
});
