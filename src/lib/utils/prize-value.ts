/**
 * Format prize value for display.
 * - fixed: show prize_value as-is; if it parses as number, optionally format as VND.
 * - percent: compute from totalRevenue, floor to nearest 10,000, format VND + "(X% doanh thu)".
 * Type comes from campaign.prizeValueType (not from prize).
 */

const FLOOR_STEP = 10_000;

export interface PrizeForDisplay {
  prizeValue: string;
  prizeValuePercent?: number | null;
  prizesCount: number;
}

/**
 * Format a number as VND (vi-VN currency).
 */
export function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
}

/**
 * Get display string for a prize value.
 * @param prize - Prize with prizeValue, prizeValuePercent, prizesCount
 * @param totalRevenue - Campaign total revenue (required when campaign type is percent)
 * @param campaignPrizeValueType - From campaign.prizeValueType ('fixed' | 'percent')
 */
export function formatPrizeValueDisplay(
  prize: PrizeForDisplay,
  totalRevenue?: number,
  campaignPrizeValueType: 'fixed' | 'percent' = 'fixed'
): string {
  const type = campaignPrizeValueType;

  if (type === 'percent') {
    const percent = prize.prizeValuePercent ?? 0;
    const revenue = totalRevenue ?? 0;
    const totalPrizeValue = (revenue * percent) / 100;
    const perPrize = totalPrizeValue / Math.max(1, prize.prizesCount);
    const floored = Math.floor(perPrize / FLOOR_STEP) * FLOOR_STEP;
    return `${formatVnd(floored)}/giải (${percent}% doanh thu)`;
  }

  // fixed: if prizeValue parses as number, format as VND; else show as-is
  const trimmed = (prize.prizeValue ?? '').trim();
  if (!trimmed) return '—';
  const num = parseInt(trimmed.replace(/\D/g, ''), 10);
  if (!Number.isNaN(num) && String(num) === trimmed.replace(/\s/g, '')) {
    return formatVnd(num);
  }
  return trimmed;
}
