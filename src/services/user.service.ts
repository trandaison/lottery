import { db } from '@/db';
import { users, type User, type NewUser } from '@/db/schema';
import { eq, or, ilike, like, desc, asc, sql } from 'drizzle-orm';
import type { UserFilters } from '@/lib/validations/user';
import { normalizePhoneForDb } from '@/lib/utils/phone';
import { authService } from '@/services/auth.service';

const SORT_COLUMNS = {
  name: users.name,
  email: users.email,
  phone: users.phone,
  role: users.role,
  createdAt: users.createdAt,
} as const;

export interface ListUsersResult {
  users: User[];
  total: number;
}

/**
 * User Service
 *
 * Handles user-related business logic including:
 * - Find or create user by email
 * - List users with search and sort
 * - Create/update users (admin)
 * - User data validation
 *
 * Architecture Principles:
 * - Uses BIGINT IDs for internal operations
 * - Generates UUIDs automatically via database
 * - Phone stored as digits only (normalized before save)
 */
export class UserService {
  /**
   * List users with optional search and sort.
   * Search: name, email, phone (contains). Phone in DB is digits-only.
   */
  async list(filters: UserFilters): Promise<ListUsersResult> {
    const { search, sortBy, sortOrder, limit, offset } = filters;
    const orderColumn = SORT_COLUMNS[sortBy] ?? users.createdAt;
    const orderDir = sortOrder === 'asc' ? asc(orderColumn) : desc(orderColumn);

    let whereCondition: ReturnType<typeof or> | undefined;
    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      const phoneDigits = search.replace(/\D/g, '');
      whereCondition = or(
        ilike(users.name, term),
        ilike(users.email, term),
        ...(phoneDigits ? [like(users.phone, `%${phoneDigits}%`)] : [])
      ) as ReturnType<typeof or>;
    }

    const countQuery = whereCondition
      ? db.select({ count: sql<number>`count(*)::int` }).from(users).where(whereCondition)
      : db.select({ count: sql<number>`count(*)::int` }).from(users);
    const [countResult] = await countQuery;
    const total = countResult?.count ?? 0;

    const listQuery = whereCondition
      ? db.select().from(users).where(whereCondition).orderBy(orderDir).limit(limit).offset(offset)
      : db.select().from(users).orderBy(orderDir).limit(limit).offset(offset);
    const list = await listQuery;

    return { users: list, total };
  }

  /**
   * Create user. Normalizes phone (digits only) and hashes password.
   */
  async create(data: {
    name: string;
    email: string;
    password: string;
    phone?: string | null;
    role?: 'admin' | 'user';
  }): Promise<User> {
    const normalizedEmail = data.email.toLowerCase().trim();
    const phone = normalizePhoneForDb(data.phone);
    const passwordDigest = await authService.hashPassword(data.password);

    const [user] = await db
      .insert(users)
      .values({
        name: data.name.trim(),
        email: normalizedEmail,
        passwordDigest,
        phone,
        role: data.role ?? 'user',
        status: 'active',
      })
      .returning();

    if (!user) throw new Error('Failed to create user');
    return user;
  }

  /**
   * Update user. Normalizes phone; hashes password only if provided.
   */
  async update(
    id: number,
    data: {
      name?: string;
      email?: string;
      password?: string;
      phone?: string | null;
      status?: 'active' | 'inactive';
      role?: 'admin' | 'user';
    }
  ): Promise<User | null> {
    const updates: Partial<NewUser> = {};
    if (data.name !== undefined) updates.name = data.name.trim();
    if (data.email !== undefined) updates.email = data.email.toLowerCase().trim();
    if (data.phone !== undefined) updates.phone = normalizePhoneForDb(data.phone);
    if (data.status !== undefined) updates.status = data.status;
    if (data.role !== undefined) updates.role = data.role;
    if (data.password !== undefined && data.password !== '') {
      updates.passwordDigest = await authService.hashPassword(data.password);
    }
    if (Object.keys(updates).length === 0) return this.getById(id);

    const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return updated ?? null;
  }

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
    const phone = normalizePhoneForDb(userData.phone);

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
        phone,
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
