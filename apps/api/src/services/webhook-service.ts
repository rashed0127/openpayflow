import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';
import {
  CreateWebhookEndpointRequest,
  PaymentError,
  generateSecureId,
  hashString,
} from '@openpayflow/common';

export class WebhookService {
  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
    private logger: Logger
  ) {}

  async createWebhookEndpoint(request: CreateWebhookEndpointRequest) {
    const correlationId = generateSecureId(8);
    
    this.logger.info({
      correlationId,
      url: request.url,
      events: request.events,
    }, 'Creating webhook endpoint');

    // Validate merchant
    const merchant = await this.validateMerchant(request.merchantApiKey);
    
    // Create webhook endpoint
    const endpoint = await this.prisma.webhookEndpoint.create({
      data: {
        merchantId: merchant.id,
        url: request.url,
        secret: request.secret,
        events: request.events,
        isActive: true,
      },
    });

    this.logger.info({
      correlationId,
      endpointId: endpoint.id,
    }, 'Webhook endpoint created');

    return endpoint;
  }

  async listWebhookEndpoints(merchantApiKey: string) {
    const merchant = await this.validateMerchant(merchantApiKey);
    
    return await this.prisma.webhookEndpoint.findMany({
      where: {
        merchantId: merchant.id,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getWebhookEndpoint(endpointId: string, merchantApiKey: string) {
    const merchant = await this.validateMerchant(merchantApiKey);
    
    const endpoint = await this.prisma.webhookEndpoint.findFirst({
      where: {
        id: endpointId,
        merchantId: merchant.id,
      },
      include: {
        deliveries: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!endpoint) {
      throw new PaymentError('Webhook endpoint not found', 'WEBHOOK_ENDPOINT_NOT_FOUND', 404);
    }

    return endpoint;
  }

  async updateWebhookEndpoint(
    endpointId: string,
    merchantApiKey: string,
    updates: {
      url?: string;
      secret?: string;
      events?: string[];
      isActive?: boolean;
    }
  ) {
    const merchant = await this.validateMerchant(merchantApiKey);
    
    const endpoint = await this.prisma.webhookEndpoint.findFirst({
      where: {
        id: endpointId,
        merchantId: merchant.id,
      },
    });

    if (!endpoint) {
      throw new PaymentError('Webhook endpoint not found', 'WEBHOOK_ENDPOINT_NOT_FOUND', 404);
    }

    const updatedEndpoint = await this.prisma.webhookEndpoint.update({
      where: { id: endpointId },
      data: updates,
    });

    return updatedEndpoint;
  }

  async deleteWebhookEndpoint(endpointId: string, merchantApiKey: string) {
    const merchant = await this.validateMerchant(merchantApiKey);
    
    const endpoint = await this.prisma.webhookEndpoint.findFirst({
      where: {
        id: endpointId,
        merchantId: merchant.id,
      },
    });

    if (!endpoint) {
      throw new PaymentError('Webhook endpoint not found', 'WEBHOOK_ENDPOINT_NOT_FOUND', 404);
    }

    await this.prisma.webhookEndpoint.delete({
      where: { id: endpointId },
    });

    return { success: true };
  }

  async simulateWebhook(
    eventType: string,
    payload: any,
    merchantApiKey: string
  ) {
    const correlationId = generateSecureId(8);
    
    this.logger.info({
      correlationId,
      eventType,
    }, 'Simulating webhook event');

    const merchant = await this.validateMerchant(merchantApiKey);

    // Create event
    const event = await this.prisma.event.create({
      data: {
        type: eventType,
        payload,
      },
    });

    // Find active webhook endpoints that listen for this event
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: {
        merchantId: merchant.id,
        isActive: true,
        events: {
          has: eventType,
        },
      },
    });

    // Create webhook deliveries
    const deliveries = await Promise.all(
      endpoints.map(endpoint =>
        this.prisma.webhookDelivery.create({
          data: {
            endpointId: endpoint.id,
            eventId: event.id,
            status: 'PENDING',
            attemptCount: 0,
          },
        })
      )
    );

    this.logger.info({
      correlationId,
      eventId: event.id,
      deliveryCount: deliveries.length,
    }, 'Webhook event created and queued for delivery');

    return {
      event,
      deliveries: deliveries.length,
    };
  }

  private async validateMerchant(apiKey: string) {
    const apiKeyHash = hashString(apiKey);
    
    const merchant = await this.prisma.merchant.findUnique({
      where: { apiKeyHash },
    });

    if (!merchant) {
      throw new PaymentError('Invalid API key', 'INVALID_API_KEY', 401);
    }

    return merchant;
  }
}
