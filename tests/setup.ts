import { beforeAll, vi } from 'vitest';
import '@testing-library/jest-dom';
import dotenv from 'dotenv';

// Load environment variables for tests
dotenv.config({ path: '.env.local' });

// Mock Redis for tests
beforeAll(() => {
  // Mock the redis module
  vi.mock('@/lib/redis', () => {
    const redisMock = {
      set: vi.fn().mockResolvedValue('OK'),
      get: vi.fn().mockResolvedValue(null),
      del: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
      ttl: vi.fn().mockResolvedValue(7200),
      keys: vi.fn().mockResolvedValue([]),
    };
    return { redis: redisMock };
  });
});
