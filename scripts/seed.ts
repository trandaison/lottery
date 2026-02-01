import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

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

// Helper function to parse CSV file
function parseCSV(filePath: string): Array<Record<string, string>> {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Split into lines while preserving newlines inside quoted fields
  const lines: string[] = [];
  let currentLine = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentLine += '"';
        i++; // Skip next quote (escaped quote)
      } else {
        inQuotes = !inQuotes;
        currentLine += char;
      }
    } else if (char === '\n' && !inQuotes) {
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
      currentLine = '';
    } else {
      currentLine += char;
    }
  }

  if (currentLine.trim()) {
    lines.push(currentLine);
  }

  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.trim());
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== headers.length) {
      // Skip rows with incorrect number of columns
      continue;
    }

    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() || '';
    });
    rows.push(row);
  }

  return rows;
}

// Helper to parse CSV line handling quoted values
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
        i++; // Skip next quote
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

// Helper to convert snake_case to camelCase
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// Helper to convert CSV row keys to camelCase
function convertKeysToCamelCase(
  row: Record<string, string>,
): Record<string, string> {
  const converted: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    converted[snakeToCamel(key)] = value;
  }
  return converted;
}

// Helper to parse date string
function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr === 'NULL' || dateStr === '') return null;
  try {
    return new Date(dateStr);
  } catch {
    return null;
  }
}

// Helper to parse boolean
function parseBoolean(boolStr: string): boolean {
  if (!boolStr) return false;
  const lower = boolStr.toLowerCase();
  return lower === 'true' || lower === 't' || lower === '1';
}

// Helper to parse integer
function parseInteger(intStr: string): number | null {
  if (!intStr || intStr === 'NULL' || intStr === '') return null;
  const parsed = parseInt(intStr, 10);
  return isNaN(parsed) ? null : parsed;
}

// Helper to parse UUID (returns undefined if NULL or empty)
function parseUUID(uuidStr: string): string | undefined {
  if (!uuidStr || uuidStr === 'NULL' || uuidStr.trim() === '') return undefined;
  return uuidStr.trim();
}

async function seed() {
  try {
    console.log('🌱 Seeding database from CSV files...\n');

    const seedDir = path.join(
      __dirname,
      '../src/db/seeds/development',
    );

    // Mapping from CSV IDs to database IDs
    const userIdMap = new Map<number, number>();
    const campaignIdMap = new Map<number, number>();

    // 1. Load users
    console.log('📂 Loading users from 01_users.csv...');
    const usersData = parseCSV(path.join(seedDir, '01_users.csv'));
    console.log(`   Found ${usersData.length} users`);

    for (const row of usersData) {
      const csvId = parseInteger(row.id);
      if (!csvId) continue;

      const userData = convertKeysToCamelCase(row);
      const insertData: any = {
        uuid: parseUUID(userData.uuid),
        name: userData.name,
        email: userData.email,
        passwordDigest: userData.passwordDigest === 'NULL' || userData.passwordDigest === '' ? null : userData.passwordDigest,
        phone: userData.phone === 'NULL' || userData.phone === '' ? null : userData.phone,
        status: userData.status,
        role: userData.role,
        createdAt: parseDate(userData.createdAt) || undefined,
        updatedAt: parseDate(userData.updatedAt) || undefined,
      };

      // Remove undefined values
      Object.keys(insertData).forEach(
        (key) => insertData[key] === undefined && delete insertData[key],
      );

      try {
        const [inserted] = await db
          .insert(users)
          .values(insertData)
          .onConflictDoUpdate({
            target: users.email,
            set: {
              name: insertData.name,
              phone: insertData.phone,
              status: insertData.status,
              role: insertData.role,
              updatedAt: insertData.updatedAt || new Date(),
            },
          })
          .returning();

        userIdMap.set(csvId, inserted.id);
      } catch (error: any) {
        // If insert fails, try to find existing user by email
        const existing = await db
          .select()
          .from(users)
          .where(eq(users.email, userData.email))
          .limit(1);
        if (existing.length > 0) {
          userIdMap.set(csvId, existing[0].id);
        } else {
          console.error(`   ⚠️  Failed to insert user ${userData.email}:`, error.message);
        }
      }
    }
    console.log(`   ✅ Loaded ${userIdMap.size} users\n`);

    // 2. Load campaigns
    console.log('📂 Loading campaigns from 02_campaigns.csv...');
    const campaignsData = parseCSV(path.join(seedDir, '02_campaigns.csv'));
    console.log(`   Found ${campaignsData.length} campaigns`);

    for (const row of campaignsData) {
      const csvId = parseInteger(row.id);
      if (!csvId) continue;

      const campaignData = convertKeysToCamelCase(row);
      const insertData: any = {
        uuid: parseUUID(campaignData.uuid),
        title: campaignData.title,
        slug: campaignData.slug,
        description: campaignData.description === 'NULL' || campaignData.description === '' ? null : campaignData.description,
        startTime: parseDate(campaignData.startTime)!,
        endTime: parseDate(campaignData.endTime)!,
        ticketPrice: parseInteger(campaignData.ticketPrice)!,
        paymentType: campaignData.paymentType,
        bankNameOrCode: campaignData.bankNameOrCode === 'NULL' || campaignData.bankNameOrCode === '' ? null : campaignData.bankNameOrCode,
        accountNumber: campaignData.accountNumber === 'NULL' || campaignData.accountNumber === '' ? null : campaignData.accountNumber,
        webhookApiKey: campaignData.webhookApiKey === 'NULL' || campaignData.webhookApiKey === '' ? null : campaignData.webhookApiKey,
        status: campaignData.status,
        excludeWinningNumbers: parseBoolean(campaignData.excludeWinningNumbers),
        canceledAt: parseDate(campaignData.canceledAt),
        createdAt: parseDate(campaignData.createdAt) || undefined,
        updatedAt: parseDate(campaignData.updatedAt) || undefined,
      };

      // Remove undefined values
      Object.keys(insertData).forEach(
        (key) => insertData[key] === undefined && delete insertData[key],
      );

      try {
        const [inserted] = await db
          .insert(campaigns)
          .values(insertData)
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
              excludeWinningNumbers: insertData.excludeWinningNumbers,
              canceledAt: insertData.canceledAt,
              updatedAt: insertData.updatedAt || new Date(),
            },
          })
          .returning();

        campaignIdMap.set(csvId, inserted.id);
      } catch (error: any) {
        // If insert fails, try to find existing campaign by slug
        const existing = await db
          .select()
          .from(campaigns)
          .where(eq(campaigns.slug, campaignData.slug))
          .limit(1);
        if (existing.length > 0) {
          campaignIdMap.set(csvId, existing[0].id);
        } else {
          console.error(`   ⚠️  Failed to insert campaign ${campaignData.slug}:`, error.message);
        }
      }
    }
    console.log(`   ✅ Loaded ${campaignIdMap.size} campaigns\n`);

    // 3. Load campaign prizes
    console.log('📂 Loading campaign prizes from 03_campaign_prizes.csv...');
    const prizesData = parseCSV(path.join(seedDir, '03_campaign_prizes.csv'));
    console.log(`   Found ${prizesData.length} prizes`);

    let prizesInserted = 0;
    for (const row of prizesData) {
      const csvCampaignId = parseInteger(row.campaign_id);
      if (!csvCampaignId) continue;

      const dbCampaignId = campaignIdMap.get(csvCampaignId);
      if (!dbCampaignId) {
        console.warn(`   ⚠️  Campaign ID ${csvCampaignId} not found, skipping prize`);
        continue;
      }

      const prizeData = convertKeysToCamelCase(row);
      const insertData: any = {
        uuid: parseUUID(prizeData.uuid),
        campaignId: dbCampaignId,
        title: prizeData.title,
        prizesCount: parseInteger(prizeData.prizesCount)!,
        matchingDigits: parseInteger(prizeData.matchingDigits)!,
        prizeValue: parseInteger(prizeData.prizeValue)!,
        createdAt: parseDate(prizeData.createdAt) || undefined,
        updatedAt: parseDate(prizeData.updatedAt) || undefined,
      };

      // Remove undefined values
      Object.keys(insertData).forEach(
        (key) => insertData[key] === undefined && delete insertData[key],
      );

      try {
        await db.insert(campaignPrizes).values(insertData).onConflictDoNothing();
        prizesInserted++;
      } catch (error: any) {
        console.error(`   ⚠️  Failed to insert prize:`, error.message);
      }
    }
    console.log(`   ✅ Loaded ${prizesInserted} prizes\n`);

    // 4. Load tickets
    console.log('📂 Loading tickets from 04_tickets.csv...');
    const ticketsData = parseCSV(path.join(seedDir, '04_tickets.csv'));
    console.log(`   Found ${ticketsData.length} tickets`);

    let ticketsInserted = 0;
    const batchSize = 1000;
    for (let i = 0; i < ticketsData.length; i += batchSize) {
      const batch = ticketsData.slice(i, i + batchSize);
      const insertBatch: any[] = [];

      for (const row of batch) {
        const csvCampaignId = parseInteger(row.campaign_id);
        const csvUserId = parseInteger(row.user_id);
        if (!csvCampaignId || !csvUserId) continue;

        const dbCampaignId = campaignIdMap.get(csvCampaignId);
        const dbUserId = userIdMap.get(csvUserId);
        if (!dbCampaignId || !dbUserId) {
          continue;
        }

        const ticketData = convertKeysToCamelCase(row);
        const insertData: any = {
          uuid: parseUUID(ticketData.uuid),
          campaignId: dbCampaignId,
          userId: dbUserId,
          ticketNumber: ticketData.ticketNumber,
          isWinning: parseBoolean(ticketData.isWinning),
          createdAt: parseDate(ticketData.createdAt) || undefined,
          updatedAt: parseDate(ticketData.updatedAt) || undefined,
        };

        // Remove undefined values
        Object.keys(insertData).forEach(
          (key) => insertData[key] === undefined && delete insertData[key],
        );

        insertBatch.push(insertData);
      }

      if (insertBatch.length > 0) {
        try {
          await db.insert(tickets).values(insertBatch).onConflictDoNothing();
          ticketsInserted += insertBatch.length;
        } catch (error: any) {
          console.error(`   ⚠️  Failed to insert batch:`, error.message);
        }
      }
    }
    console.log(`   ✅ Loaded ${ticketsInserted} tickets\n`);

    console.log('✅ Database seeded successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`   - Users: ${userIdMap.size}`);
    console.log(`   - Campaigns: ${campaignIdMap.size}`);
    console.log(`   - Prizes: ${prizesInserted}`);
    console.log(`   - Tickets: ${ticketsInserted}\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seed();
