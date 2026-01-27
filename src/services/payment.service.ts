/**
 * Payment Service
 * Handles payment-related operations including QR URL generation and JWT webhook authentication
 */

/**
 * Generate VietQR URL for bank transfer payment
 * @param accountNumber - Bank account number
 * @param bankNameOrCode - Bank name or code
 * @param amount - Amount in VND
 * @param paymentReferenceId - Payment reference ID (e.g., "LTR000001")
 * @returns QR URL string
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
 * Generate JWT token for SePay webhook authentication
 * Uses campaign UUID as the subject claim
 * @param campaignUuid - Campaign UUID
 * @returns JWT token
 */
/**
 * SePay webhook payload structure
 */
export interface SepayWebhookPayload {
  gateway: string;
  transactionDate: string;
  accountNumber: string;
  subAccount: string | null;
  code: string; // Payment reference ID
  content: string;
  transferType: string;
  description: string | null;
  transferAmount: number;
  referenceCode: string; // SePay transaction ID
  accumulated: number;
  id: number;
}

/**
 * Reconciliation result
 */
export interface ReconciliationResult {
  success: boolean;
  errors: string[];
  payload: SepayWebhookPayload;
}

/**
 * Reconcile webhook payment with order
 * @param payload - Webhook payload from SePay
 * @param expectedAmount - Expected amount from order
 * @param expectedAccountNumber - Expected account number from campaign
 * @returns Reconciliation result
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
