import { useState, useEffect, useRef } from 'react';
import type { ApiResponse } from '@/types';

interface OrderStatus {
  order: {
    id: number;
    uuid: string;
    paymentReferenceId: string;
    totalAmount: number;
    ticketsCount: number;
    paymentType: 'direct' | 'transfer';
    paymentStatus: 'pending' | 'success' | 'failed';
    expiresAt: Date | null;
    errorMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  tickets?: Array<{ id: number; ticketNumber: string }>;
  isExpired?: boolean;
  campaign?: {
    accountNumber: string | null;
    bankNameOrCode: string | null;
  };
}

interface UseOrderPollingOptions {
  referenceId: string;
  enabled?: boolean;
  interval?: number; // Polling interval in milliseconds (default: 3000)
  onStatusChange?: (status: 'pending' | 'success' | 'failed') => void;
}

interface UseOrderPollingResult {
  order: OrderStatus['order'] | null;
  tickets: OrderStatus['tickets'];
  campaign: OrderStatus['campaign'];
  isLoading: boolean;
  error: string | null;
  isExpired: boolean;
}

/**
 * useOrderPolling Hook
 *
 * Polls order status API every N seconds while order is pending
 * Stops polling when:
 * - Order status changes (success/failed)
 * - Component unmounts
 * - enabled is set to false
 * - Order expires
 *
 * Architecture Principles:
 * - Single responsibility: Handle order status polling
 * - Clean hook design with proper cleanup
 * - Error handling and loading states
 */
export function useOrderPolling({
  referenceId,
  enabled = true,
  interval = 3000,
  onStatusChange,
}: UseOrderPollingOptions): UseOrderPollingResult {
  const [order, setOrder] = useState<OrderStatus['order'] | null>(null);
  const [tickets, setTickets] = useState<OrderStatus['tickets']>(undefined);
  const [campaign, setCampaign] = useState<OrderStatus['campaign']>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousStatusRef = useRef<'pending' | 'success' | 'failed' | null>(null);

  const fetchOrderStatus = async () => {
    try {
      const response = await fetch(`/api/v1/orders/${referenceId}`);
      const result: ApiResponse<OrderStatus> = await response.json();

      if (!result.success) {
        setError(result.error?.message || 'Failed to fetch order status');
        return;
      }

      if (result.data) {
        // Parse Date objects from API response (they come as strings)
        const orderData = {
          ...result.data.order,
          expiresAt: result.data.order.expiresAt
            ? new Date(result.data.order.expiresAt)
            : null,
          createdAt: new Date(result.data.order.createdAt),
          updatedAt: new Date(result.data.order.updatedAt),
        };

        setOrder(orderData);
        setTickets(result.data.tickets);
        setCampaign(result.data.campaign);
        setIsExpired(result.data.isExpired || false);

        // Check if status changed
        if (
          previousStatusRef.current !== null &&
          previousStatusRef.current !== result.data.order.paymentStatus
        ) {
          onStatusChange?.(result.data.order.paymentStatus);
        }

        previousStatusRef.current = result.data.order.paymentStatus;

        // Stop polling if order is no longer pending or expired
        if (
          result.data.order.paymentStatus !== 'pending' ||
          result.data.isExpired
        ) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      }
    } catch (err) {
      console.error('Error fetching order status:', err);
      setError('Network error. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!enabled || !referenceId) {
      return;
    }

    // Initial fetch
    fetchOrderStatus();

    // Set up polling interval
    intervalRef.current = setInterval(() => {
      fetchOrderStatus();
    }, interval);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [referenceId, enabled, interval]);

  return {
    order,
    tickets,
    campaign,
    isLoading,
    error,
    isExpired,
  };
}
