#!/usr/bin/env tsx
/**
 * Chạy: pnpm tsx scripts/test-ticket-image.ts
 * Gọi ticketImageService, ghi ảnh ra scripts/ticket-output.png
 * Chỉnh tham số render trong src/services/ticket-image.service.ts
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import { ticketImageService } from '../src/services/ticket-image.service';

const OUT_PATH = join(__dirname, 'ticket-output.png');

async function main() {
  const ticket = { ticketNumber: '123456' };
  const campaign = { title: 'Campaign test' };

  const buffer = await ticketImageService.generateTicketImage(ticket, campaign);
  writeFileSync(OUT_PATH, buffer);

  console.log('✅ Đã ghi ảnh:', OUT_PATH);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
