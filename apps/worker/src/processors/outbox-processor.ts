import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';
import { QUEUE_NAMES } from '@openpayflow/common';

export class OutboxProcessor {
  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
    private logger: Logger
  ) {}

  async start() {
    this.logger.info('Starting outbox processor');
    
    // Process outbox entries every 5 seconds
    setInterval(() => {
      this.processOutboxEntries().catch((error) => {
        this.logger.error({ error }, 'Error processing outbox entries');
      });
    }, 5000);
  }

  private async processOutboxEntries() {
    try {
      // Get unprocessed outbox entries
      const entries = await this.prisma.outbox.findMany({
        where: { processed: false },
        orderBy: { createdAt: 'asc' },
        take: 100,
      });

      if (entries.length === 0) {
        return;
      }

      this.logger.debug({ count: entries.length }, 'Processing outbox entries');

      for (const entry of entries) {
        await this.processOutboxEntry(entry);
      }
    } catch (error) {
      this.logger.error({ error }, 'Failed to process outbox entries');
    }
  }

  private async processOutboxEntry(entry: any) {
    try {
      // Create domain event
      const event = await this.prisma.event.create({
        data: {
          type: entry.eventType,
          payload: entry.payload,
        },
      });

      // Find webhook endpoints that should receive this event
      const endpoints = await this.prisma.webhookEndpoint.findMany({
        where: {
          isActive: true,
          events: {
            has: entry.eventType,
          },
        },
      });

      // Create webhook deliveries
      const deliveries = await Promise.all(
        endpoints.map((endpoint: any) =>
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

      // Queue webhook deliveries for processing
      for (const delivery of deliveries) {
        await this.queueWebhookDelivery(delivery);
      }

      // Mark outbox entry as processed
      await this.prisma.outbox.update({
        where: { id: entry.id },
        data: { processed: true },
      });

      this.logger.debug({
        entryId: entry.id,
        eventId: event.id,
        deliveryCount: deliveries.length,
      }, 'Processed outbox entry');

    } catch (error) {
      this.logger.error({
        entryId: entry.id,
        error,
      }, 'Failed to process outbox entry');
    }
  }

  private async queueWebhookDelivery(delivery: any) {
    await this.redis.lpush(
      QUEUE_NAMES.WEBHOOK_DELIVERY,
      JSON.stringify({
        deliveryId: delivery.id,
        timestamp: Date.now(),
      })
    );
  }
}
