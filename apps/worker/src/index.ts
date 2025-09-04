import { logger } from './utils/logger';
import { prisma } from './utils/database';
import { redis } from './utils/redis';
import { OutboxProcessor } from './processors/outbox-processor';
import { WebhookProcessor } from './processors/webhook-processor';
import * as cron from 'node-cron';

// Initialize OpenTelemetry before importing anything else
import './utils/telemetry';

async function start() {
  try {
    logger.info('OpenPayFlow Worker starting...');
    
    // Test database connection
    await prisma.$connect();
    logger.info('Connected to database');

    // Test Redis connection
    await redis.connect();
    logger.info('Connected to Redis');

    // Initialize processors
    const outboxProcessor = new OutboxProcessor(prisma, redis, logger);
    const webhookProcessor = new WebhookProcessor(prisma, redis, logger);

    // Start processors
    await outboxProcessor.start();
    await webhookProcessor.start();

    // Setup cron jobs for cleanup tasks
    setupCleanupJobs();
    
    logger.info('OpenPayFlow Worker started successfully');
    
    // Keep the process running
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully');
      await cleanup();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully');
      await cleanup();
      process.exit(0);
    });

  } catch (error) {
    logger.error(error, 'Failed to start worker');
    process.exit(1);
  }
}

function setupCleanupJobs() {
  // Clean up old processed outbox entries daily at 2 AM
  cron.schedule('0 2 * * *', async () => {
    try {
      logger.info('Running outbox cleanup job');
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 7); // Keep for 7 days
      
      const result = await prisma.outbox.deleteMany({
        where: {
          processed: true,
          createdAt: {
            lt: cutoffDate,
          },
        },
      });
      
      logger.info({ deletedCount: result.count }, 'Outbox cleanup completed');
    } catch (error) {
      logger.error({ error }, 'Outbox cleanup failed');
    }
  });

  // Clean up old delivered webhook deliveries weekly on Sunday at 3 AM
  cron.schedule('0 3 * * 0', async () => {
    try {
      logger.info('Running webhook deliveries cleanup job');
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30); // Keep for 30 days
      
      const result = await prisma.webhookDelivery.deleteMany({
        where: {
          status: 'DELIVERED',
          createdAt: {
            lt: cutoffDate,
          },
        },
      });
      
      logger.info({ deletedCount: result.count }, 'Webhook deliveries cleanup completed');
    } catch (error) {
      logger.error({ error }, 'Webhook deliveries cleanup failed');
    }
  });

  // Clean up old events monthly on the 1st at 4 AM
  cron.schedule('0 4 1 * *', async () => {
    try {
      logger.info('Running events cleanup job');
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90); // Keep for 90 days
      
      // Only delete events that have no pending webhook deliveries
      const result = await prisma.event.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
          webhookDeliveries: {
            none: {
              status: {
                in: ['PENDING', 'FAILED'],
              },
            },
          },
        },
      });
      
      logger.info({ deletedCount: result.count }, 'Events cleanup completed');
    } catch (error) {
      logger.error({ error }, 'Events cleanup failed');
    }
  });
}

async function cleanup() {
  try {
    await prisma.$disconnect();
    await redis.quit();
    logger.info('Worker shutdown completed');
  } catch (error) {
    logger.error({ error }, 'Error during shutdown');
  }
}

start();
