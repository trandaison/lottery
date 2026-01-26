import { describe, it, expect } from 'vitest';
import { cn } from '../lib/utils';

describe('Utils', () => {
  describe('cn', () => {
    it('should merge class names correctly', () => {
      const result = cn('text-red-500', 'bg-blue-500');
      expect(result).toContain('text-red-500');
      expect(result).toContain('bg-blue-500');
    });

    it('should override conflicting classes', () => {
      const result = cn('text-red-500', 'text-blue-500');
      expect(result).toBe('text-blue-500');
    });

    it('should handle conditional classes', () => {
      const result = cn('base-class', false && 'hidden', true && 'visible');
      expect(result).toContain('base-class');
      expect(result).toContain('visible');
      expect(result).not.toContain('hidden');
    });
  });
});
