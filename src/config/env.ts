import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),
  JWT_SECRET: z.string(),
  // Email configuration
  SENDGRID_API_KEY: z.string().optional(), // Required for production
  // SMTP configuration for MailHog (local/dev/test). Use 127.0.0.1 to avoid IPv6 ::1 when MailHog listens on IPv4 only.
  SMTP_HOST: z.string().optional().default('127.0.0.1'),
  SMTP_PORT: z.string().optional().default('1025'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional().default('noreply@lottery.com'),
  EMAIL_FROM_NAME: z.string().optional().default('Lottery System'),
  APP_URL: z.string().optional(),
  SEPAY_WEBHOOK_JWT_SECRET: z.string(),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.error('❌ Invalid environment variables:', { error, env: process.env });
    throw error;
  }
}

export const env = validateEnv();
