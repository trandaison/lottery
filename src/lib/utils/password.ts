/**
 * Generate a strong password (client-side).
 * Default: 12 characters with uppercase, lowercase, numbers, and symbols.
 */
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // exclude I, O
const LOWER = 'abcdefghjkmnpqrstuvwxyz';   // exclude i, l, o
const DIGITS = '23456789';                  // exclude 0, 1
const SYMBOLS = '!@#$%&*';

/**
 * Returns a random character from the given string.
 */
function pick(str: string): string {
  return str[Math.floor(Math.random() * str.length)];
}

/**
 * Generate a password of length 12 with at least one of each: upper, lower, digit, symbol.
 */
export function generateStrongPassword(length: number = 12): string {
  const minPerType = 1;
  const parts: string[] = [
    pick(UPPER),
    pick(LOWER),
    pick(DIGITS),
    pick(SYMBOLS),
  ];
  const pool = UPPER + LOWER + DIGITS + SYMBOLS;
  for (let i = parts.length; i < length; i++) {
    parts.push(pick(pool));
  }
  // Shuffle
  for (let i = parts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [parts[i], parts[j]] = [parts[j], parts[i]];
  }
  return parts.join('');
}
