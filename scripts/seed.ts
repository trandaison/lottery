import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';

// Load environment variables FIRST
dotenv.config({ path: '.env.local' });

// Import schema after env is loaded
import {
  users,
  campaigns,
  campaignPrizes,
  tickets,
} from '../src/db/schema';

// Create database client directly without env validation
const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, {
  schema: { users, campaigns, campaignPrizes, tickets },
});

const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD ?? 'password123';
const SALT_ROUNDS = 10;

/** Seed context shared across handlers (CSV id -> DB id maps, seeded emails for password update) */
type SeedContext = {
  userIdMap: Map<number, number>;
  campaignIdMap: Map<number, number>;
  /** Emails of users we seeded — only these get password updated to DEFAULT_PASSWORD */
  seededUserEmails: string[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSeedDir(): string | null {
  const base = path.join(__dirname, '../src/db/seeds');
  const env = process.env.NODE_ENV || 'development';
  let dir = path.join(base, env);

  return fs.existsSync(dir) ? dir : null;
}

function getCsvFiles(seedDir: string | null): string[] {
  if (!seedDir) return [];

  return fs
    .readdirSync(seedDir)
    .filter((f) => f.endsWith('.csv'))
    .sort();
}

/** Parse table key from filename: 01_users.csv -> users, 03_campaign_prizes.csv -> campaign_prizes */
function tableKeyFromFilename(filename: string): string {
  const name = path.basename(filename, '.csv');
  const match = name.match(/^\d+_(.+)$/);
  return match ? match[1] : name;
}

function parseCSV(filePath: string): Array<Record<string, string>> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines: string[] = [];
  let currentLine = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentLine += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
        currentLine += char;
      }
    } else if (char === '\n' && !inQuotes) {
      if (currentLine.trim()) lines.push(currentLine);
      currentLine = '';
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim()) lines.push(currentLine);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.trim());
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== headers.length) continue;
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() || '';
    });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function convertKeysToCamelCase(row: Record<string, string>): Record<string, string> {
  const converted: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    converted[snakeToCamel(key)] = value;
  }
  return converted;
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr === 'NULL' || dateStr === '') return null;
  try {
    return new Date(dateStr);
  } catch {
    return null;
  }
}

function parseBoolean(boolStr: string): boolean {
  if (!boolStr) return false;
  const lower = boolStr.toLowerCase();
  return lower === 'true' || lower === 't' || lower === '1';
}

function parseInteger(intStr: string): number | null {
  if (!intStr || intStr === 'NULL' || intStr === '') return null;
  const parsed = parseInt(intStr, 10);
  return isNaN(parsed) ? null : parsed;
}

function parseUUID(uuidStr: string): string | undefined {
  if (!uuidStr || uuidStr === 'NULL' || uuidStr.trim() === '') return undefined;
  return uuidStr.trim();
}

function omitUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj };
  Object.keys(out).forEach((key) => {
    if (out[key] === undefined) delete out[key];
  });
  return out;
}

// ---------------------------------------------------------------------------
// Seed handlers (per table)
// ---------------------------------------------------------------------------

async function seedUsers(
  filePath: string,
  ctx: SeedContext,
): Promise<void> {
  const rows = parseCSV(filePath);
  console.log(`   Found ${rows.length} users`);

  for (const row of rows) {
    const csvId = parseInteger(row.id);
    if (!csvId) continue;

    const userData = convertKeysToCamelCase(row);

    // Find or create: if user exists by email, skip (do not update — avoid resetting password on deploy)
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, userData.email))
      .limit(1);

    if (existing.length > 0) {
      ctx.userIdMap.set(csvId, existing[0].id);
      continue;
    }

    // Create new user only
    const insertData = omitUndefined({
      uuid: parseUUID(userData.uuid),
      name: userData.name,
      email: userData.email,
      passwordDigest: userData.passwordDigest === 'NULL' || userData.passwordDigest === '' ? null : userData.passwordDigest,
      phone: userData.phone === 'NULL' || userData.phone === '' ? null : userData.phone,
      status: (userData.status === 'active' || userData.status === 'inactive' ? userData.status : 'active') as 'active' | 'inactive',
      role: (userData.role === 'admin' || userData.role === 'user' ? userData.role : 'user') as 'admin' | 'user',
      createdAt: parseDate(userData.createdAt) || undefined,
      updatedAt: parseDate(userData.updatedAt) || undefined,
    });

    try {
      const [inserted] = await db.insert(users).values(insertData as typeof users.$inferInsert).returning();
      ctx.userIdMap.set(csvId, inserted.id);
      ctx.seededUserEmails.push(inserted.email);
    } catch (error: unknown) {
      console.error(`   ⚠️  Failed to insert user ${userData.email}:`, (error as Error).message);
    }
  }
  console.log(`   ✅ Loaded ${ctx.userIdMap.size} users (${ctx.seededUserEmails.length} created, ${ctx.userIdMap.size - ctx.seededUserEmails.length} already existed)`);
}

async function seedCampaigns(filePath: string, ctx: SeedContext): Promise<void> {
  const rows = parseCSV(filePath);
  console.log(`   Found ${rows.length} campaigns`);

  for (const row of rows) {
    const csvId = parseInteger(row.id);
    if (!csvId) continue;

    const campaignData = convertKeysToCamelCase(row);
    const insertData = omitUndefined({
      uuid: parseUUID(campaignData.uuid),
      title: campaignData.title,
      slug: campaignData.slug,
      description: campaignData.description === 'NULL' || campaignData.description === '' ? null : campaignData.description,
      startTime: parseDate(campaignData.startTime)!,
      endTime: parseDate(campaignData.endTime)!,
      ticketPrice: parseInteger(campaignData.ticketPrice)!,
      minimumTickets: parseInteger(campaignData.minimumTickets) ?? 1,
      paymentType: (campaignData.paymentType === 'direct' || campaignData.paymentType === 'transfer' ? campaignData.paymentType : 'direct') as 'direct' | 'transfer',
      bankNameOrCode: campaignData.bankNameOrCode === 'NULL' || campaignData.bankNameOrCode === '' ? null : campaignData.bankNameOrCode,
      accountNumber: campaignData.accountNumber === 'NULL' || campaignData.accountNumber === '' ? null : campaignData.accountNumber,
      webhookApiKey: campaignData.webhookApiKey === 'NULL' || campaignData.webhookApiKey === '' ? null : campaignData.webhookApiKey,
      status: (['active', 'drawing', 'completed', 'canceled'].includes(campaignData.status) ? campaignData.status : 'active') as 'active' | 'drawing' | 'completed' | 'canceled',
      prizeValueType: (campaignData.prizeValueType === 'percent' ? 'percent' : 'fixed') as 'fixed' | 'percent',
      excludeWinningNumbers: parseBoolean(campaignData.excludeWinningNumbers),
      canceledAt: parseDate(campaignData.canceledAt),
      createdAt: parseDate(campaignData.createdAt) || undefined,
      updatedAt: parseDate(campaignData.updatedAt) || undefined,
    });

    try {
      const [inserted] = await db
        .insert(campaigns)
        .values(insertData as typeof campaigns.$inferInsert)
        .onConflictDoUpdate({
          target: campaigns.slug,
          set: {
            title: insertData.title,
            description: insertData.description,
            startTime: insertData.startTime,
            endTime: insertData.endTime,
            ticketPrice: insertData.ticketPrice,
            paymentType: insertData.paymentType,
            bankNameOrCode: insertData.bankNameOrCode,
            accountNumber: insertData.accountNumber,
            webhookApiKey: insertData.webhookApiKey,
            status: insertData.status,
            prizeValueType: insertData.prizeValueType,
            excludeWinningNumbers: insertData.excludeWinningNumbers,
            canceledAt: insertData.canceledAt,
            updatedAt: insertData.updatedAt || new Date(),
          },
        })
        .returning();

      ctx.campaignIdMap.set(csvId, inserted.id);
    } catch (error: unknown) {
      const existing = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.slug, campaignData.slug))
        .limit(1);
      if (existing.length > 0) {
        ctx.campaignIdMap.set(csvId, existing[0].id);
      } else {
        console.error(`   ⚠️  Failed to insert campaign ${campaignData.slug}:`, (error as Error).message);
      }
    }
  }
  console.log(`   ✅ Loaded ${ctx.campaignIdMap.size} campaigns`);
}

async function seedCampaignPrizes(filePath: string, ctx: SeedContext): Promise<number> {
  const rows = parseCSV(filePath);
  console.log(`   Found ${rows.length} prizes`);
  let count = 0;

  for (const row of rows) {
    const csvCampaignId = parseInteger(row.campaign_id);
    if (!csvCampaignId) continue;

    const dbCampaignId = ctx.campaignIdMap.get(csvCampaignId);
    if (!dbCampaignId) {
      console.warn(`   ⚠️  Campaign ID ${csvCampaignId} not found, skipping prize`);
      continue;
    }

    const prizeData = convertKeysToCamelCase(row);
    const uuidVal = parseUUID(prizeData.uuid);
    if (!uuidVal) {
      console.warn(`   ⚠️  Prize campaign_id=${csvCampaignId} missing uuid, skipping`);
      continue;
    }

    const insertData = omitUndefined({
      uuid: uuidVal,
      campaignId: dbCampaignId,
      title: prizeData.title,
      prizesCount: parseInteger(prizeData.prizesCount)!,
      matchingDigits: parseInteger(prizeData.matchingDigits)!,
      prizeValue: typeof prizeData.prizeValue === 'string' ? prizeData.prizeValue : String(parseInteger(prizeData.prizeValue) ?? ''),
      prizeValuePercent: prizeData.prizeValuePercent != null ? parseInteger(prizeData.prizeValuePercent) : undefined,
      displayOrder: parseInteger(prizeData.displayOrder) ?? 0,
      createdAt: parseDate(prizeData.createdAt) || undefined,
      updatedAt: parseDate(prizeData.updatedAt) || undefined,
    });

    try {
      await db
        .insert(campaignPrizes)
        .values(insertData as typeof campaignPrizes.$inferInsert)
        .onConflictDoNothing({ target: campaignPrizes.uuid });
      count++;
    } catch (error: unknown) {
      console.error(`   ⚠️  Failed to insert prize:`, (error as Error).message);
    }
  }
  console.log(`   ✅ Loaded ${count} prizes`);
  return count;
}

async function seedTickets(filePath: string, ctx: SeedContext): Promise<number> {
  const rows = parseCSV(filePath);
  console.log(`   Found ${rows.length} tickets`);
  const batchSize = 1000;
  let count = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const insertBatch: typeof tickets.$inferInsert[] = [];

    for (const row of batch) {
      const csvCampaignId = parseInteger(row.campaign_id);
      const csvUserId = parseInteger(row.user_id);
      if (!csvCampaignId || !csvUserId) continue;

      const dbCampaignId = ctx.campaignIdMap.get(csvCampaignId);
      const dbUserId = ctx.userIdMap.get(csvUserId);
      if (!dbCampaignId || !dbUserId) continue;

      const ticketData = convertKeysToCamelCase(row);
      insertBatch.push(
        omitUndefined({
          uuid: parseUUID(ticketData.uuid),
          campaignId: dbCampaignId,
          userId: dbUserId,
          ticketNumber: ticketData.ticketNumber,
          isWinning: parseBoolean(ticketData.isWinning),
          createdAt: parseDate(ticketData.createdAt) || undefined,
          updatedAt: parseDate(ticketData.updatedAt) || undefined,
        }) as typeof tickets.$inferInsert,
      );
    }

    if (insertBatch.length > 0) {
      try {
        await db
          .insert(tickets)
          .values(insertBatch)
          .onConflictDoNothing({
            target: [tickets.campaignId, tickets.ticketNumber],
          });
        count += insertBatch.length;
      } catch (error: unknown) {
        console.error(`   ⚠️  Failed to insert ticket batch:`, (error as Error).message);
      }
    }
  }
  console.log(`   ✅ Loaded ${count} tickets`);
  return count;
}

/** Update password only for users that were in the seed file (avoid resetting other accounts). */
async function updateSeededUsersPassword(emails: string[]): Promise<void> {
  if (emails.length === 0) return;
  const hashed = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);
  for (const email of emails) {
    await db.update(users).set({ passwordDigest: hashed, updatedAt: new Date() }).where(eq(users.email, email));
  }
  console.log(`   ✅ Set password for ${emails.length} seeded user(s) (DEFAULT_PASSWORD)`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const TABLE_HANDLERS: Record<
  string,
  (filePath: string, ctx: SeedContext) => Promise<number | void>
> = {
  users: (p, ctx) => seedUsers(p, ctx),
  campaigns: (p, ctx) => seedCampaigns(p, ctx),
  campaign_prizes: (p, ctx) => seedCampaignPrizes(p, ctx),
  campaignPrizes: (p, ctx) => seedCampaignPrizes(p, ctx),
  tickets: (p, ctx) => seedTickets(p, ctx),
};

async function seed() {
  try {
    const env = process.env.NODE_ENV || 'development';
    const seedDir = getSeedDir();
    const csvFiles = getCsvFiles(seedDir);

    console.log(`🌱 Seeding database (NODE_ENV=${env}) from ${path.relative(process.cwd(), seedDir || '')}...\n`);

    if (csvFiles.length === 0) {
      console.log('   No CSV files found. Skipping seed.');
      process.exit(0);
      return;
    }

    const ctx: SeedContext = {
      userIdMap: new Map(),
      campaignIdMap: new Map(),
      seededUserEmails: [],
    };

    const stats: { users: number; campaigns: number; prizes: number; tickets: number } = {
      users: 0,
      campaigns: 0,
      prizes: 0,
      tickets: 0,
    };

    for (const filename of csvFiles) {
      const key = tableKeyFromFilename(filename);
      const handler = TABLE_HANDLERS[key];
      if (!handler) {
        console.warn(`   ⚠️  No handler for table "${key}" (file ${filename}), skipping.`);
        continue;
      }

      const filePath = path.join(seedDir!, filename);
      console.log(`📂 Loading ${key} from ${filename}...`);
      const result = await handler(filePath, ctx);
      if (typeof result === 'number') {
        if (key === 'campaign_prizes' || key === 'campaignPrizes') stats.prizes = result;
        else if (key === 'tickets') stats.tickets = result;
      }
      if (key === 'users') stats.users = ctx.userIdMap.size;
      if (key === 'campaigns') stats.campaigns = ctx.campaignIdMap.size;
      console.log('');
    }

    // Only update password for users that were in the seed file (never touch other accounts)
    if (ctx.seededUserEmails.length > 0) {
      console.log('🔐 Updating password for seeded users only...');
      await updateSeededUsersPassword(ctx.seededUserEmails);
      console.log('');
    }

    console.log('✅ Database seeded successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`   - Users: ${stats.users}`);
    console.log(`   - Campaigns: ${stats.campaigns}`);
    console.log(`   - Prizes: ${stats.prizes}`);
    console.log(`   - Tickets: ${stats.tickets}\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seed();
