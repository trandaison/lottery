import { createCanvas, loadImage } from 'canvas';
import { join } from 'path';
import type { Ticket } from '@/db/schema/tickets';
import type { Campaign } from '@/db/schema/campaigns';

/**
 * Ticket Image Generation Service
 *
 * Generates ticket images by loading a template and drawing ticket numbers on it.
 * Uses node-canvas for server-side image generation.
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
    // In Next.js, we need to use absolute path or copy to public folder
    // For server-side, we can use the source path directly
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
      // Load template image
      const template = await loadImage(this.templatePath);

      // Create canvas with template dimensions
      const canvas = createCanvas(this.templateWidth, this.templateHeight);
      const ctx = canvas.getContext('2d');

      // Draw template image
      ctx.drawImage(template, 0, 0, this.templateWidth, this.templateHeight);

      // Draw ticket number
      // Font: Arial, size 46, line height 1
      // Position: (252, 186)
      ctx.font = '46px Arial';
      ctx.fillStyle = '#000000'; // Black text
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(ticket.ticketNumber, 252, 186);

      // Export as PNG buffer
      return canvas.toBuffer('image/png');
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
