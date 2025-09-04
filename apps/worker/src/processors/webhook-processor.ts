import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';
import {
  QUEUE_NAMES,
  WEBHOOK_CONFIG,
  calculateRetryDelay,
  verifyHmacSignature,
} from '@openpayflow/common';
import fetch, { Response } from 'node-fetch';
import * as crypto from 'crypto';

export class WebhookProcessor {
  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
    private logger: Logger
  ) {}

  async start() {
    this.logger.info('Starting webhook processor');
    
    // Process webhook deliveries
    this.processWebhookDeliveries();
    
    // Process retry queue
    this.processRetryQueue();
  }

  private async processWebhookDeliveries() {
    while (true) {
      try {
        // Block and wait for webhook delivery jobs
        const result = await this.redis.brpop(QUEUE_NAMES.WEBHOOK_DELIVERY, 10);
        
        if (result) {
          const [, jobData] = result;
          const job = JSON.parse(jobData);
          await this.processWebhookDelivery(job.deliveryId);
        }
      } catch (error) {
        this.logger.error({ error }, 'Error processing webhook deliveries');
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  private async processRetryQueue() {
    // Process retry queue every 30 seconds
    setInterval(async () => {
      try {
        const now = new Date();
        
        // Find deliveries that are ready for retry
        const deliveries = await this.prisma.webhookDelivery.findMany({
          where: {
            status: 'FAILED',
            nextRetryAt: {
              lte: now,
            },
            attemptCount: {
              lt: WEBHOOK_CONFIG.MAX_DELIVERY_ATTEMPTS,
            },
          },
          take: 50,
        });

        for (const delivery of deliveries) {
          await this.processWebhookDelivery(delivery.id);
        }
      } catch (error) {
        this.logger.error({ error }, 'Error processing retry queue');
      }
    }, 30000);
  }

  private async processWebhookDelivery(deliveryId: string) {
    try {
      // Get delivery with related data
      const delivery = await this.prisma.webhookDelivery.findUnique({
        where: { id: deliveryId },
        include: {
          endpoint: true,
          event: true,
        },
      });

      if (!delivery) {
        this.logger.warn({ deliveryId }, 'Webhook delivery not found');
        return;
      }

      if (delivery.status === 'DELIVERED') {
        this.logger.debug({ deliveryId }, 'Webhook already delivered');
        return;
      }

      if (delivery.attemptCount >= WEBHOOK_CONFIG.MAX_DELIVERY_ATTEMPTS) {
        await this.markDeliveryAbandoned(delivery);
        return;
      }

      this.logger.info({
        deliveryId,
        endpointUrl: delivery.endpoint.url,
        eventType: delivery.event.type,
        attempt: delivery.attemptCount + 1,
      }, 'Attempting webhook delivery');

      // Increment attempt count
      await this.prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          attemptCount: delivery.attemptCount + 1,
        },
      });

      // Prepare webhook payload
      const payload = {
        id: delivery.event.id,
        type: delivery.event.type,
        created: Math.floor(delivery.event.createdAt.getTime() / 1000),
        data: delivery.event.payload,
      };

      const payloadString = JSON.stringify(payload);
      
      // Generate signature
      const signature = crypto
        .createHmac('sha256', delivery.endpoint.secret)
        .update(payloadString)
        .digest('hex');

      // Send webhook
      const response = await fetch(delivery.endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'OpenPayFlow/1.0',
          'X-OpenPayFlow-Signature': `sha256=${signature}`,
          'X-OpenPayFlow-Event-Type': delivery.event.type,
          'X-OpenPayFlow-Delivery-Id': delivery.id,
        },
        body: payloadString,
        timeout: WEBHOOK_CONFIG.TIMEOUT_MS,
      });

      if (response.ok) {
        // Success - mark as delivered
        await this.prisma.webhookDelivery.update({
          where: { id: deliveryId },
          data: {
            status: 'DELIVERED',
            lastError: null,
            nextRetryAt: null,
          },
        });

        this.logger.info({
          deliveryId,
          statusCode: response.status,
          attempt: delivery.attemptCount + 1,
        }, 'Webhook delivered successfully');

      } else {
        // Failed - schedule retry
        const errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        await this.scheduleRetry(delivery, errorMessage);
      }

    } catch (error) {
      this.logger.error({
        deliveryId,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Webhook delivery failed');

      // Schedule retry
      const delivery = await this.prisma.webhookDelivery.findUnique({
        where: { id: deliveryId },
      });

      if (delivery) {
        await this.scheduleRetry(delivery, error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }

  private async scheduleRetry(delivery: any, errorMessage: string) {
    const nextRetryDelay = calculateRetryDelay(
      delivery.attemptCount + 1,
      WEBHOOK_CONFIG.INITIAL_RETRY_DELAY_MS
    );

    const nextRetryAt = new Date(Date.now() + nextRetryDelay);

    // Cap the retry delay at max
    const cappedRetryAt = new Date(
      Math.min(
        nextRetryAt.getTime(),
        Date.now() + WEBHOOK_CONFIG.MAX_RETRY_DELAY_MS
      )
    );

    await this.prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'FAILED',
        lastError: errorMessage,
        nextRetryAt: cappedRetryAt,
      },
    });

    this.logger.info({
      deliveryId: delivery.id,
      nextRetryAt: cappedRetryAt,
      attempt: delivery.attemptCount + 1,
      error: errorMessage,
    }, 'Webhook delivery scheduled for retry');
  }

  private async markDeliveryAbandoned(delivery: any) {
    await this.prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'ABANDONED',
        nextRetryAt: null,
      },
    });

    this.logger.warn({
      deliveryId: delivery.id,
      endpointUrl: delivery.endpoint.url,
      attempts: delivery.attemptCount,
    }, 'Webhook delivery abandoned after max attempts');

    // Move to dead letter queue for manual inspection
    await this.redis.lpush(
      QUEUE_NAMES.DEAD_LETTER,
      JSON.stringify({
        type: 'webhook_delivery_abandoned',
        deliveryId: delivery.id,
        endpointId: delivery.endpointId,
        eventId: delivery.eventId,
        attempts: delivery.attemptCount,
        lastError: delivery.lastError,
        timestamp: Date.now(),
      })
    );
  }
}
