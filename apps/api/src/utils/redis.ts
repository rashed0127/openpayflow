import Redis from 'ioredis';
import { logger } from './logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on('connect', () => {
  logger.info('Connected to Redis');
});

redis.on('error', (error) => {
  logger.error({ error }, 'Redis connection error');
});

redis.on('reconnecting', () => {
  logger.info('Reconnecting to Redis');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await redis.quit();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await redis.quit();
  process.exit(0);
});

export default redis;
