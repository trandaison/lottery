// Database types from schema
export type {
  User,
  NewUser,
  Campaign,
  NewCampaign,
  CampaignPrize,
  NewCampaignPrize,
  Ticket,
  NewTicket,
  Order,
  NewOrder,
  OrderTicket,
  NewOrderTicket,
  WinningNumber,
  NewWinningNumber,
} from '@/db/schema';

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Campaign DTOs
export interface CampaignWithPrizes {
  id: number;
  uuid: string;
  title: string;
  slug: string;
  description: string | null;
  startTime: Date;
  endTime: Date;
  ticketPrice: number;
  paymentType: 'direct' | 'transfer';
  bankNameOrCode: string | null;
  accountNumber: string | null;
  webhookApiKey: string | null;
  status: 'active' | 'drawing' | 'completed' | 'canceled';
  excludeWinningNumbers: boolean;
  canceledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  prizes: CampaignPrizeDTO[];
}

export interface CampaignPrizeDTO {
  id: number;
  uuid: string;
  campaignId: number;
  title: string;
  prizesCount: number;
  matchingDigits: number;
  prizeValue: number;
  createdAt: Date;
  updatedAt: Date;
  winningNumber?: WinningNumberDTO;
}

export interface WinningNumberDTO {
  id: number;
  uuid: string;
  campaignPrizeId: number;
  number: string;
  createdAt: Date;
  updatedAt: Date;
}

// Order DTOs
export interface OrderWithTickets {
  id: number;
  uuid: string;
  campaignId: number;
  userId: number;
  ticketsCount: number;
  totalAmount: number;
  paymentReferenceId: string;
  expiresAt: Date | null;
  paymentType: 'direct' | 'transfer';
  paymentStatus: 'pending' | 'success' | 'failed';
  errorMessage: string | null;
  sepayTransactionId: string | null;
  receivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  tickets?: TicketDTO[];
  user?: UserDTO;
  campaign?: CampaignDTO;
}

export interface TicketDTO {
  id: number;
  uuid: string;
  campaignId: number;
  userId: number;
  ticketNumber: string;
  isWinning: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserDTO {
  id: number;
  uuid: string;
  name: string;
  email: string;
  phone: string | null;
  status: 'active' | 'inactive';
  role: 'admin' | 'user';
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignDTO {
  id: number;
  uuid: string;
  title: string;
  slug: string;
  description: string | null;
  startTime: Date;
  endTime: Date;
  ticketPrice: number;
  paymentType: 'direct' | 'transfer';
  status: 'active' | 'drawing' | 'completed' | 'canceled';
  createdAt: Date;
  updatedAt: Date;
}

// Campaign Statistics
export interface CampaignStatistics {
  ticketsSold: number;
  participantsCount: number;
  totalRevenue: number;
}

// Purchase Request/Response
export interface PurchaseTicketRequest {
  campaignSlug: string;
  name: string;
  email: string;
  phone: string;
  ticketsCount: number;
}

export interface PurchaseTicketResponse {
  order: OrderWithTickets;
  paymentInfo?: {
    qrCode: string;
    bankInfo: {
      bankName: string;
      accountNumber: string;
      accountHolder: string;
    };
    amount: number;
    content: string;
    expiresAt: Date;
  };
}

// Draw DTOs
export interface DrawRequest {
  prizeId: number;
  draftMode: boolean;
}

export interface DrawResponse {
  winningNumber: string;
  matchingTickets: TicketDTO[];
  savedWinningNumber?: WinningNumberDTO;
}
