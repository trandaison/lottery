// Export all schema tables and types
export * from './users';
export * from './campaigns';
export * from './campaign-prizes';
export * from './tickets';
export * from './orders';
export * from './order-tickets';
export * from './winning-numbers';

// Re-export all tables for easier access
import { users } from './users';
import { campaigns } from './campaigns';
import { campaignPrizes } from './campaign-prizes';
import { tickets } from './tickets';
import { orders } from './orders';
import { orderTickets } from './order-tickets';
import { winningNumbers } from './winning-numbers';

export const schema = {
  users,
  campaigns,
  campaignPrizes,
  tickets,
  orders,
  orderTickets,
  winningNumbers,
};
