/**
 * Draw utilities: digit extraction and dynamic arrays for 6-wheel draw.
 * Position 0 = rightmost digit (s[5]), position 5 = leftmost (s[0]).
 */

/**
 * Get digit array for a single position (0 = rightmost … 5 = leftmost).
 * - numbers: list of 6-digit strings (server ensures length).
 * - position: 0 = rightmost, 5 = leftmost. Char index in string = 5 - position.
 * - suffixSoFar: trailing digits already fixed (length = position). Only needed for position > 0.
 *   When suffixSoFar.length < position, returns "basic" set (unique digits at this position from all numbers) so all 6 wheels can run at once.
 * - winningNumberSuffixes6: list of winning numbers padded to 6 chars for comparison.
 * - excludeWinningNumbers: if true, remove digit d when (d + suffixSoFar) matches tail of any winning number.
 */
export function getDigitArrayForPosition(
  numbers: string[],
  position: number,
  suffixSoFar?: string,
  winningNumberSuffixes6?: string[],
  excludeWinningNumbers?: boolean
): number[] {
  if (position < 0 || position > 5) return [];
  const charIndex = 5 - position;

  const normalize = (str: string) => str.padStart(6, '0').slice(-6);

  if (position === 0) {
    const seen = new Set<string>();
    const result: number[] = [];
    for (const raw of numbers) {
      const s = normalize(raw);
      const ch = s[charIndex]!;
      if (!seen.has(ch)) {
        seen.add(ch);
        const d = parseInt(ch, 10);
        if (!excludeWinningNumbers || !winningNumberSuffixes6?.length) {
          result.push(d);
          continue;
        }
        const tail = ch;
        const matches = winningNumberSuffixes6.some((wn) => {
          const w6 = wn.padStart(6, '0').slice(-6);
          return w6.slice(-1) === tail;
        });
        if (!matches) result.push(d);
      }
    }
    return result;
  }

  const suffix = suffixSoFar ?? '';
  if (suffix.length < position) {
    const seen = new Set<string>();
    const result: number[] = [];
    for (const raw of numbers) {
      const s = normalize(raw);
      const ch = s[charIndex]!;
      if (!seen.has(ch)) {
        seen.add(ch);
        result.push(parseInt(ch, 10));
      }
    }
    return result;
  }

  const seen = new Set<string>();
  const result: number[] = [];
  for (const raw of numbers) {
    const s = normalize(raw);
    const currentTail = s.slice(6 - position);
    if (currentTail !== suffix) continue;
    const ch = s[charIndex]!;
    if (!seen.has(ch)) {
      seen.add(ch);
      const d = parseInt(ch, 10);
      const newSuffix = ch + suffix;
      if (!excludeWinningNumbers || !winningNumberSuffixes6?.length) {
        result.push(d);
        continue;
      }
      const len = position + 1;
      const matches = winningNumberSuffixes6.some((wn) => {
        const w6 = wn.padStart(6, '0').slice(-6);
        return w6.slice(-len) === newSuffix;
      });
      if (!matches) result.push(d);
    }
  }
  return result;
}
