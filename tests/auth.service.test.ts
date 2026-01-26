import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { authService } from '@/services/auth.service';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Note: These tests require a running Redis instance and PostgreSQL database
// To run these tests: ensure Redis is running and database is seeded
// For CI/CD: consider using Redis and Postgres Docker containers

describe('AuthService - Integration Tests', () => {
  const testUser = {
    email: 'test-auth@example.com',
    password: 'testpassword123',
    name: 'Test Auth User',
    role: 'admin' as const,
    status: 'active' as const,
  };

  let testUserId: number;

  beforeEach(async () => {
    // Create test user
    const hashedPassword = await authService.hashPassword(testUser.password);

    // Check if user already exists
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, testUser.email))
      .limit(1);

    if (existing.length > 0) {
      testUserId = existing[0].id;
      // Update password
      await db
        .update(users)
        .set({ passwordDigest: hashedPassword })
        .where(eq(users.id, testUserId));
    } else {
      const [user] = await db
        .insert(users)
        .values({
          email: testUser.email,
          name: testUser.name,
          passwordDigest: hashedPassword,
          role: testUser.role,
          status: testUser.status,
        })
        .returning();
      testUserId = user.id;
    }
  });

  afterEach(async () => {
    // Clean up test user
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
  });

  describe('Password Hashing', () => {
    it('should hash password correctly', async () => {
      const password = 'testpassword123';
      const hash = await authService.hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(20);
    });

    it('should compare password correctly', async () => {
      const password = 'testpassword123';
      const hash = await authService.hashPassword(password);

      const isValid = await authService.comparePassword(password, hash);
      expect(isValid).toBe(true);

      const isInvalid = await authService.comparePassword('wrongpassword', hash);
      expect(isInvalid).toBe(false);
    });
  });

  describe('Token Generation', () => {
    it('should generate unique token base', () => {
      const token1 = authService.generateTokenBase();
      const token2 = authService.generateTokenBase();

      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2);
      expect(token1).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('should generate and verify JWT token', () => {
      const tokenBase = authService.generateTokenBase();
      const jwt = authService.generateAccessToken(tokenBase);

      expect(jwt).toBeDefined();
      expect(typeof jwt).toBe('string');

      const decoded = authService.verifyAccessToken(jwt);
      expect(decoded).toBeDefined();
      expect(decoded?.sub).toBe(tokenBase);
    });

    it('should reject invalid JWT token', () => {
      const invalidToken = 'invalid.jwt.token';
      const decoded = authService.verifyAccessToken(invalidToken);
      expect(decoded).toBeNull();
    });
  });

  describe('User Operations', () => {
    it('should find user by email', async () => {
      const user = await authService.findUserByEmail(testUser.email);

      expect(user).toBeDefined();
      expect(user?.email).toBe(testUser.email);
      expect(user?.name).toBe(testUser.name);
    });

    it('should return null for non-existent email', async () => {
      const user = await authService.findUserByEmail('nonexistent@example.com');
      expect(user).toBeNull();
    });

    it('should find user by ID', async () => {
      const user = await authService.findUserById(testUserId);

      expect(user).toBeDefined();
      expect(user?.id).toBe(testUserId);
      expect(user?.email).toBe(testUser.email);
    });

    it('should return null for non-existent ID', async () => {
      const user = await authService.findUserById(999999);
      expect(user).toBeNull();
    });
  });

  // Skip Redis-dependent tests in CI or when Redis is not available
  // These tests require a running Redis instance
  describe.skip('Redis Session Management (requires Redis)', () => {
    it('should create and retrieve session', async () => {
      // This test requires Redis to be running
      const tokenBase = await authService.createSession(testUserId, false);
      expect(tokenBase).toBeDefined();

      const session = await authService.getSession(tokenBase);
      expect(session).toBeDefined();
      expect(session?.userId).toBe(testUserId);
    });
  });

  describe.skip('Login Flow (requires Redis)', () => {
    it('should login with valid credentials', async () => {
      // This test requires Redis to be running
      const result = await authService.login(
        testUser.email,
        testUser.password,
        false
      );

      expect(result).toBeDefined();
      expect(result?.user.email).toBe(testUser.email);
    });

    it('should return null for invalid credentials', async () => {
      const result = await authService.login(
        testUser.email,
        'wrongpassword',
        false
      );

      expect(result).toBeNull();
    });
  });
});

describe('AuthService - Unit Tests (without Redis)', () => {
  it('should generate valid UUID v4', () => {
    const uuid = authService.generateTokenBase();
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('should hash passwords differently each time', async () => {
    const password = 'samepassword';
    const hash1 = await authService.hashPassword(password);
    const hash2 = await authService.hashPassword(password);

    expect(hash1).not.toBe(hash2); // Bcrypt uses random salt

    // But both should validate
    expect(await authService.comparePassword(password, hash1)).toBe(true);
    expect(await authService.comparePassword(password, hash2)).toBe(true);
  });

  it('should create valid JWT structure', () => {
    const tokenBase = authService.generateTokenBase();
    const jwt = authService.generateAccessToken(tokenBase);

    // JWT should have 3 parts
    const parts = jwt.split('.');
    expect(parts).toHaveLength(3);

    // Should be able to decode
    const decoded = authService.verifyAccessToken(jwt);
    expect(decoded?.sub).toBe(tokenBase);
    expect(decoded).toHaveProperty('iat');
  });
});
