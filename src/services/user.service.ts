import { db } from '@/db';
import { users, type User, type NewUser } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * User Service
 *
 * Handles user-related business logic including:
 * - Find or create user by email
 * - User data validation
 *
 * Architecture Principles:
 * - Uses BIGINT IDs for internal operations
 * - Generates UUIDs automatically via database
 * - Follows clean code and single responsibility principle
 */
export class UserService {
  /**
   * Find or create user by email
   * If user exists, return existing user
   * If user doesn't exist, create new user with provided data
   *
   * @param email - User email (unique identifier)
   * @param userData - User data for creation (name, phone)
   * @returns User object
   */
  async findOrCreate(
    email: string,
    userData: {
      name: string;
      phone?: string;
    }
  ): Promise<User> {
    // Normalize email (lowercase, trim)
    const normalizedEmail = email.toLowerCase().trim();

    // Try to find existing user
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingUser) {
      return existingUser;
    }

    // Create new user
    const [newUser] = await db
      .insert(users)
      .values({
        email: normalizedEmail,
        name: userData.name,
        phone: userData.phone || null,
        status: 'active',
        role: 'user',
        passwordDigest: null, // Guest users don't have passwords
      })
      .returning();

    return newUser;
  }

  /**
   * Get user by ID
   */
  async getById(id: number): Promise<User | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return user || null;
  }

  /**
   * Get user by email
   */
  async getByEmail(email: string): Promise<User | null> {
    const normalizedEmail = email.toLowerCase().trim();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    return user || null;
  }
}

// Export singleton instance
export const userService = new UserService();
