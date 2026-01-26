import { db } from '@/db';
import { redis } from '@/lib/redis';
import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';

export async function GET() {
  const checks = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    services: {
      database: {
        status: 'unknown',
        message: '',
        responseTime: 0,
      },
      redis: {
        status: 'unknown',
        message: '',
        responseTime: 0,
      },
    },
  };

  // Check Database
  try {
    const dbStart = Date.now();
    await db.execute(sql`SELECT 1 as health_check`);
    checks.services.database.status = 'healthy';
    checks.services.database.message = 'PostgreSQL connection successful';
    checks.services.database.responseTime = Date.now() - dbStart;
  } catch (error) {
    checks.services.database.status = 'unhealthy';
    checks.services.database.message =
      error instanceof Error ? error.message : 'Database connection failed';
    checks.status = 'unhealthy';
  }

  // Check Redis
  try {
    const redisStart = Date.now();
    const pong = await redis.ping();
    checks.services.redis.status = pong === 'PONG' ? 'healthy' : 'unhealthy';
    checks.services.redis.message =
      pong === 'PONG'
        ? 'Redis connection successful'
        : 'Redis ping failed';
    checks.services.redis.responseTime = Date.now() - redisStart;
  } catch (error) {
    checks.services.redis.status = 'unhealthy';
    checks.services.redis.message =
      error instanceof Error ? error.message : 'Redis connection failed';
    checks.status = 'unhealthy';
  }

  const statusCode = checks.status === 'healthy' ? 200 : 503;

  return NextResponse.json(checks, { status: statusCode });
}
