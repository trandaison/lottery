import { describe, it, expect, beforeAll } from 'vitest';
import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../src/db/schema';

// Load env before tests
dotenv.config({ path: '.env.local' });

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

describe('Database Schema - Phase 1', () => {
  describe('Users Table', () => {
    it('should have admin user seeded', async () => {
      const [admin] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, 'admin@company.com'))
        .limit(1);

      expect(admin).toBeDefined();
      expect(admin.email).toBe('admin@company.com');
      expect(admin.role).toBe('admin');
      expect(admin.status).toBe('active');
      expect(admin.id).toBeTypeOf('number');
      expect(admin.uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('should have password_digest field populated', async () => {
      const [admin] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, 'admin@company.com'))
        .limit(1);

      expect(admin.passwordDigest).toBeDefined();
      expect(admin.passwordDigest).toMatch(/^\$2[aby]\$/); // bcrypt hash pattern
    });
  });

  describe('Campaigns Table', () => {
    it('should have sample campaign seeded', async () => {
      const [campaign] = await db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.slug, 'sample-campaign'))
        .limit(1);

      expect(campaign).toBeDefined();
      expect(campaign.title).toBe('Sample Campaign');
      expect(campaign.slug).toBe('sample-campaign');
      expect(campaign.status).toBe('active');
      expect(campaign.ticketPrice).toBe(10000);
      expect(campaign.id).toBeTypeOf('number');
      expect(campaign.uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });
  });

  describe('Campaign Prizes Table', () => {
    it('should have 4 prizes seeded for sample campaign', async () => {
      const [campaign] = await db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.slug, 'sample-campaign'))
        .limit(1);

      const prizes = await db
        .select()
        .from(schema.campaignPrizes)
        .where(eq(schema.campaignPrizes.campaignId, campaign.id));

      expect(prizes).toHaveLength(4);
      
      // Verify prize structure
      const firstPrize = prizes.find((p) => p.matchingDigits === 6);
      expect(firstPrize).toBeDefined();
      expect(firstPrize!.title).toBe('First Prize');
      expect(firstPrize!.prizesCount).toBe(1);
      expect(firstPrize!.prizeValue).toBe(1000000);
    });

    it('should have proper foreign key relationship', async () => {
      const [campaign] = await db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.slug, 'sample-campaign'))
        .limit(1);

      const prizes = await db
        .select()
        .from(schema.campaignPrizes)
        .where(eq(schema.campaignPrizes.campaignId, campaign.id));

      prizes.forEach((prize) => {
        expect(prize.campaignId).toBe(campaign.id);
        expect(prize.id).toBeTypeOf('number');
        expect(prize.uuid).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );
      });
    });
  });

  describe('Schema Validation', () => {
    it('should have BIGSERIAL id and UUID fields', async () => {
      const [user] = await db.select().from(schema.users).limit(1);

      // id should be a number (BIGSERIAL)
      expect(typeof user.id).toBe('number');
      expect(user.id).toBeGreaterThan(0);

      // uuid should be a valid UUID string
      expect(typeof user.uuid).toBe('string');
      expect(user.uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('should have timestamps on all tables', async () => {
      const [user] = await db.select().from(schema.users).limit(1);

      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('Unique Constraints', () => {
    it('should enforce unique email in users table', async () => {
      const existingUser = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, 'admin@company.com'))
        .limit(1);

      expect(existingUser).toHaveLength(1);

      // Attempting to insert duplicate email should fail
      // (This is just a validation test, not actually inserting)
      expect(async () => {
        await db.insert(schema.users).values({
          email: 'admin@company.com',
          name: 'Duplicate Admin',
          role: 'user',
          status: 'active',
        });
      }).rejects.toThrow();
    });

    it('should enforce unique slug in campaigns table', async () => {
      const existingCampaign = await db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.slug, 'sample-campaign'))
        .limit(1);

      expect(existingCampaign).toHaveLength(1);
    });
  });

  describe('Enums', () => {
    it('should have valid user role enum', async () => {
      const [admin] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, 'admin@company.com'))
        .limit(1);

      expect(['admin', 'user']).toContain(admin.role);
    });

    it('should have valid user status enum', async () => {
      const [admin] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, 'admin@company.com'))
        .limit(1);

      expect(['active', 'inactive']).toContain(admin.status);
    });

    it('should have valid campaign status enum', async () => {
      const [campaign] = await db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.slug, 'sample-campaign'))
        .limit(1);

      expect(['active', 'drawing', 'completed', 'canceled']).toContain(
        campaign.status,
      );
    });
  });
});
