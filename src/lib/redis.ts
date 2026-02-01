import Redis from 'ioredis';
import { env } from '@/config/env';

let redis: Redis;

if (typeof window === 'undefined') {
  if (!env) {
    throw new Error('Environment variables not validated. Call validateEnv() before using redis.');
  }
  // Only create Redis client on server-side
  redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  redis.on('connect', () => {
    console.log('✅ Redis connected successfully');
  });

  redis.on('error', (error) => {
    console.error('❌ Redis connection error:', error);
  });
}

export { redis };
