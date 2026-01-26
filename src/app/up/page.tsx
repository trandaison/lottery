import { Metadata } from 'next';
import { db } from '@/db';
import { redis } from '@/lib/redis';
import { sql } from 'drizzle-orm';

export const metadata: Metadata = {
  title: 'Health Check | Lottery System',
  description: 'System health check and status monitoring',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getHealthStatus() {
  const checks = {
    timestamp: new Date().toISOString(),
    status: 'healthy' as 'healthy' | 'unhealthy' | 'error',
    services: {
      database: {
        status: 'unknown' as 'healthy' | 'unhealthy' | 'unknown',
        message: '',
        responseTime: 0,
      },
      redis: {
        status: 'unknown' as 'healthy' | 'unhealthy' | 'unknown',
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

  return checks;
}

export default async function HealthCheckPage() {
  const data = await getHealthStatus();
  const isHealthy = data.status === 'healthy';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center space-x-3">
              <div
                className={`w-4 h-4 rounded-full ${
                  isHealthy
                    ? 'bg-green-500 animate-pulse'
                    : 'bg-red-500'
                }`}
              />
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                System Health Check
              </h1>
            </div>
            <p className="text-slate-600 dark:text-slate-400">
              Lottery System Status Monitor
            </p>
          </div>

          {/* Overall Status */}
          <div
            className={`p-6 rounded-xl border-2 ${
              isHealthy
                ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Overall Status
                </p>
                <p
                  className={`text-2xl font-bold ${
                    isHealthy
                      ? 'text-green-700 dark:text-green-400'
                      : 'text-red-700 dark:text-red-400'
                  }`}
                >
                  {isHealthy ? '✓ Healthy' : '✗ Unhealthy'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Timestamp
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {data.timestamp ? new Date(data.timestamp).toLocaleString() : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Services Status */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Services
            </h2>

            {/* Database Status */}
            {data.services?.database && (
              <ServiceCard
                name="PostgreSQL Database"
                status={data.services.database.status}
                message={data.services.database.message}
                responseTime={data.services.database.responseTime}
                icon="🗄️"
              />
            )}

            {/* Redis Status */}
            {data.services?.redis && (
              <ServiceCard
                name="Redis Cache"
                status={data.services.redis.status}
                message={data.services.redis.message}
                responseTime={data.services.redis.responseTime}
                icon="⚡"
              />
            )}
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
              <span>Lottery System v0.1.0</span>
              <span>Phase 0 Complete ✓</span>
            </div>
          </div>
        </div>

        {/* API Endpoint Info */}
        <div className="mt-6 p-4 bg-slate-800 dark:bg-slate-900 rounded-lg">
          <p className="text-xs font-mono text-slate-300 dark:text-slate-400">
            API Endpoint:{' '}
            <a
              href="/api/health"
              className="text-blue-400 hover:underline"
              target="_blank"
            >
              /api/health
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

interface ServiceCardProps {
  name: string;
  status: string;
  message: string;
  responseTime?: number;
  icon: string;
}

function ServiceCard({
  name,
  status,
  message,
  responseTime,
  icon,
}: ServiceCardProps) {
  const isHealthy = status === 'healthy';

  return (
    <div
      className={`p-4 rounded-lg border ${
        isHealthy
          ? 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800/50'
          : 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800/50'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">
              {name}
            </h3>
            <p
              className={`text-sm mt-1 ${
                isHealthy
                  ? 'text-green-700 dark:text-green-400'
                  : 'text-red-700 dark:text-red-400'
              }`}
            >
              {message}
            </p>
          </div>
        </div>
        <div className="text-right">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              isHealthy
                ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
            }`}
          >
            {isHealthy ? '✓ Healthy' : '✗ Error'}
          </span>
          {responseTime !== undefined && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {responseTime}ms
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
