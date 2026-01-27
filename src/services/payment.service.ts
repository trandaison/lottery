/**
 * Payment Service
 *
 * Handles payment-related operations including:
 * - QR URL generation for bank transfers
 * - Payment reconciliation logic
 * - Webhook payload types
 *
 * Architecture Principles:
 * - Pure functions for business logic
 * - Type-safe interfaces
 * - Clear error messages
 * - Follows clean code and single responsibility principle
 */

/**
 * SePay webhook payload structure
 * Matches the format sent by SePay payment gateway
 */
export interface SepayWebhookPayload {
  gateway: string;
  transactionDate: string;
  accountNumber: string;
  subAccount: string | null;
  code: string; // Payment reference ID (e.g., "LTR000001")
  content: string;
  transferType: string;
  description: string | null;
  transferAmount: number; // Amount in VND
  referenceCode: string; // SePay transaction ID
  accumulated: number;
  id: number;
}

/**
 * Reconciliation result
 * Contains success status, errors, and original payload
 */
export interface ReconciliationResult {
  success: boolean;
  errors: string[];
  payload: SepayWebhookPayload;
}

/**
 * Generate VietQR URL for bank transfer payment
 *
 * URL format: https://qr.sepay.vn/img?acc={accountNumber}&bank={bankNameOrCode}&amount={amount}&des={referenceId}
 *
 * @param accountNumber - Bank account number
 * @param bankNameOrCode - Bank name or code
 * @param amount - Amount in VND
 * @param paymentReferenceId - Payment reference ID (e.g., "LTR000001")
 * @returns QR URL string
 *
 * @example
 * generateQRUrl("0706213188", "Vietcombank", 100000, "LTR000001")
 * // Returns: "https://qr.sepay.vn/img?acc=0706213188&bank=Vietcombank&amount=100000&des=LTR000001"
 */
export function generateQRUrl(
  accountNumber: string,
  bankNameOrCode: string,
  amount: number,
  paymentReferenceId: string,
): string {
  const params = new URLSearchParams({
    acc: accountNumber,
    bank: bankNameOrCode,
    amount: amount.toString(),
    des: paymentReferenceId,
  });

  return `https://qr.sepay.vn/img?${params.toString()}`;
}

/**
 * Reconcile webhook payment with order
 *
 * Validates that:
 * 1. Transfer amount matches expected order amount
 * 2. Account number matches expected campaign account number
 *
 * @param payload - Webhook payload from SePay
 * @param expectedAmount - Expected amount from order (in VND)
 * @param expectedAccountNumber - Expected account number from campaign
 * @returns Reconciliation result with success status and any errors
 *
 * @example
 * const result = reconcilePayment(payload, 100000, "0706213188");
 * if (result.success) {
 *   // Process payment
 * } else {
 *   // Handle errors: result.errors
 * }
 */
export function reconcilePayment(
  payload: SepayWebhookPayload,
  expectedAmount: number,
  expectedAccountNumber: string,
): ReconciliationResult {
  const errors: string[] = [];

  // Check amount match
  if (payload.transferAmount !== expectedAmount) {
    errors.push(
      `Amount mismatch: expected ${expectedAmount}, got ${payload.transferAmount}`,
    );
  }

  // Check account number match
  if (payload.accountNumber !== expectedAccountNumber) {
    errors.push(
      `Account number mismatch: expected ${expectedAccountNumber}, got ${payload.accountNumber}`,
    );
  }

  return {
    success: errors.length === 0,
    errors,
    payload,
  };
}
