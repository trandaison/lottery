/**
 * Phone number utilities.
 * - normalizePhoneForDb: strip non-digits before saving to DB.
 * - formatPhoneDisplay: display as 070.621.3188 (3.3.4).
 */

/**
 * Strip all non-digit characters from a phone string.
 * Use before saving to DB.
 */
export function normalizePhoneForDb(phone: string | null | undefined): string | null {
  if (phone == null || typeof phone !== 'string') return null;
  const digits = phone.replace(/\D/g, '');
  return digits === '' ? null : digits;
}

/**
 * Format digits as 070.621.3188 (first 3, then 3, then rest).
 * Input can be raw string (non-digits are stripped) or already digits-only.
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  const digits = normalizePhoneForDb(phone) ?? '';
  if (digits.length === 0) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
}
