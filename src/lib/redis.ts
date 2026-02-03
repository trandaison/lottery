import { Redis } from '@upstash/redis';
import { env } from '@/config/env';

let redis: Redis;

if (typeof window === 'undefined') {
  if (!env) {
    throw new Error('Environment variables not validated. Call validateEnv() before using redis.');
  }
  // Parse REDIS_URL (rediss://default:TOKEN@host:6379) → REST URL + token
  const u = new URL(env.REDIS_URL);
  redis = new Redis({
    url: `https://${u.hostname}`,
    token: u.password,
  });
  console.log('✅ Redis (Upstash) client initialized');
}

export { redis };
