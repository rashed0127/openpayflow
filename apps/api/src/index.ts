import { createApp } from './app';
import { config } from './utils/config';
import { logger } from './utils/logger';
import { prisma } from './utils/database';
import { redis } from './utils/redis';

// Initialize OpenTelemetry before importing anything else
import './utils/telemetry';

async function start() {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('Connected to database');

    // Test Redis connection
    await redis.connect();
    logger.info('Connected to Redis');

    // Create and start the app
    const app = await createApp();
    
    const address = await app.listen({
      port: config.PORT,
      host: '0.0.0.0',
    });

    logger.info(`Server listening at ${address}`);
    logger.info(`API documentation available at ${address}/docs`);
    
    if (config.ENABLE_GRAPHQL) {
      logger.info(`GraphQL playground available at ${address}/graphql`);
    }

  } catch (error) {
    logger.error(error, 'Failed to start server');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully');
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
});

start();
