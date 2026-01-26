import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { redis } from '@/lib/redis';
import { env } from '@/config/env';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { User } from '@/types';

// Types
export interface SessionData {
  userId: number;
  rememberMe: boolean;
  timestamp: number;
}

export interface AuthTokens {
  accessToken: string;
  tokenBase: string;
}

export interface LoginResult {
  user: Omit<User, 'passwordDigest'>;
  tokens: AuthTokens;
}

// Constants
const SALT_ROUNDS = 10;
const SESSION_PREFIX = 'session:';
const SHORT_SESSION_TTL = 2 * 60 * 60; // 2 hours in seconds
const LONG_SESSION_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * Authentication Service
 * Handles password hashing, JWT generation, and Redis session management
 */
export class AuthService {
  /**
   * Hash a password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  /**
   * Compare a password with its hash
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate a unique token base (UUID v4)
   */
  generateTokenBase(): string {
    return uuidv4();
  }

  /**
   * Create a session in Redis
   */
  async createSession(
    userId: number,
    rememberMe: boolean = false
  ): Promise<string> {
    const tokenBase = this.generateTokenBase();
    const ttl = rememberMe ? LONG_SESSION_TTL : SHORT_SESSION_TTL;

    const sessionData: SessionData = {
      userId,
      rememberMe,
      timestamp: Date.now(),
    };

    const key = `${SESSION_PREFIX}${tokenBase}`;
    await redis.set(key, JSON.stringify(sessionData), 'EX', ttl);

    return tokenBase;
  }

  /**
   * Get session data from Redis
   */
  async getSession(tokenBase: string): Promise<SessionData | null> {
    const key = `${SESSION_PREFIX}${tokenBase}`;
    const data = await redis.get(key);

    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data) as SessionData;
    } catch (error) {
      console.error('Failed to parse session data:', error);
      return null;
    }
  }

  /**
   * Delete session from Redis (logout)
   */
  async deleteSession(tokenBase: string): Promise<void> {
    const key = `${SESSION_PREFIX}${tokenBase}`;
    await redis.del(key);
  }

  /**
   * Update session TTL (extend session on activity)
   */
  async updateSessionTTL(
    tokenBase: string,
    rememberMe: boolean
  ): Promise<void> {
    const key = `${SESSION_PREFIX}${tokenBase}`;
    const ttl = rememberMe ? LONG_SESSION_TTL : SHORT_SESSION_TTL;
    await redis.expire(key, ttl);
  }

  /**
   * Generate JWT access token with token_base as subject
   */
  generateAccessToken(tokenBase: string): string {
    return jwt.sign(
      {
        sub: tokenBase,
        iat: Math.floor(Date.now() / 1000),
      },
      env.JWT_SECRET,
      {
        expiresIn: '7d', // Max lifetime, actual session controlled by Redis
      }
    );
  }

  /**
   * Verify and decode JWT token
   */
  verifyAccessToken(token: string): { sub: string } | null {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as { sub: string };
      return decoded;
    } catch (error) {
      console.error('JWT verification failed:', error);
      return null;
    }
  }

  /**
   * Find user by email
   */
  async findUserByEmail(email: string): Promise<User | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return user || null;
  }

  /**
   * Find user by ID
   */
  async findUserById(id: number): Promise<User | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return user || null;
  }

  /**
   * Authenticate user with email and password
   * Creates session in Redis and generates JWT
   */
  async login(
    email: string,
    password: string,
    rememberMe: boolean = false
  ): Promise<LoginResult | null> {
    // Find user by email
    const user = await this.findUserByEmail(email);
    if (!user) {
      return null;
    }

    // Verify password
    const isValidPassword = await this.comparePassword(
      password,
      user.passwordDigest || ''
    );
    if (!isValidPassword) {
      return null;
    }

    // Check if user is active
    if (user.status !== 'active') {
      throw new Error('USER_INACTIVE');
    }

    // Create session in Redis
    const tokenBase = await this.createSession(user.id, rememberMe);

    // Generate JWT access token
    const accessToken = this.generateAccessToken(tokenBase);

    // Return user data (without password) and tokens
    const { passwordDigest, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      tokens: {
        accessToken,
        tokenBase,
      },
    };
  }

  /**
   * Logout user by deleting session from Redis
   */
  async logout(tokenBase: string): Promise<void> {
    await this.deleteSession(tokenBase);
  }

  /**
   * Verify authentication and get user data
   * Checks JWT validity and Redis session existence
   */
  async verifyAuth(token: string): Promise<User | null> {
    // Verify JWT
    const decoded = this.verifyAccessToken(token);
    if (!decoded) {
      return null;
    }

    const tokenBase = decoded.sub;

    // Check if session exists in Redis
    const session = await this.getSession(tokenBase);
    if (!session) {
      return null;
    }

    // Get user data
    const user = await this.findUserById(session.userId);
    if (!user || user.status !== 'active') {
      // Clean up invalid session
      await this.deleteSession(tokenBase);
      return null;
    }

    // Update session TTL (extend on activity)
    await this.updateSessionTTL(tokenBase, session.rememberMe);

    return user;
  }

  /**
   * Check if a session exists in Redis
   */
  async sessionExists(tokenBase: string): Promise<boolean> {
    const session = await this.getSession(tokenBase);
    return session !== null;
  }
}

// Export singleton instance
export const authService = new AuthService();
