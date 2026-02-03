import sharp from 'sharp';
import { join } from 'path';
import type { Ticket } from '@/db/schema/tickets';
import type { Campaign } from '@/db/schema/campaigns';

/**
 * Escape text for Pango markup (used by sharp for text rendering).
 * Prevents injection of markup from ticket number.
 */
function escapePangoMarkup(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Ticket Image Generation Service
 *
 * Generates ticket images by loading a template and drawing ticket numbers on it.
 * Uses sharp for server-side image generation (no native canvas dependency).
 *
 * Architecture Principles:
 * - Single responsibility: Only handles image generation
 * - Clean code: Simple, focused methods
 * - Template-based: Uses predefined template image
 */
export class TicketImageService {
  private readonly templatePath: string;
  private readonly templateWidth: number = 500;
  private readonly templateHeight: number = 256;

  constructor() {
    // Template path: src/assets/img/ticket_template.png
    this.templatePath = join(process.cwd(), 'src', 'assets', 'img', 'ticket_template.png');
  }

  /**
   * Generate ticket image with ticket number drawn on template
   *
   * @param ticket - Ticket object with ticketNumber
   * @param campaign - Campaign object (optional, for future use)
   * @returns PNG buffer
   */
  async generateTicketImage(
    ticket: Pick<Ticket, 'ticketNumber'>,
    campaign?: Pick<Campaign, 'title'>
  ): Promise<Buffer> {
    try {
      // 46pt in Pango = size 46000 (thousandths of a point). Black text, transparent background.
      const textMarkup = `<span size="46000" foreground="black">${escapePangoMarkup(ticket.ticketNumber)}</span>`;

      const image = await sharp(this.templatePath)
        .composite([
          {
            input: {
              text: {
                text: textMarkup,
                font: 'Arial',
                rgba: true,
              },
            },
            left: 252,
            top: 186,
          },
        ])
        .png()
        .toBuffer();

      return image;
    } catch (error) {
      console.error('[TicketImageService] Error generating ticket image:', error);
      throw new Error(
        `TICKET_IMAGE_GENERATION_FAILED: Failed to generate image for ticket ${ticket.ticketNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate multiple ticket images
   *
   * @param tickets - Array of tickets
   * @param campaign - Campaign object (optional)
   * @returns Array of PNG buffers (one per ticket)
   */
  async generateTicketImages(
    tickets: Array<Pick<Ticket, 'ticketNumber'>>,
    campaign?: Pick<Campaign, 'title'>
  ): Promise<Buffer[]> {
    const images: Buffer[] = [];

    for (const ticket of tickets) {
      const image = await this.generateTicketImage(ticket, campaign);
      images.push(image);
    }

    return images;
  }
}

// Export singleton instance
export const ticketImageService = new TicketImageService();
