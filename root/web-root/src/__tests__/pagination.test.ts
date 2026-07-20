import { describe, it, expect } from 'vitest';

// Test the pagination range helper (same logic as in UserManagementView)
function getPaginationRange(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '...')[] = [];
  pages.push(1);
  if (current > 3) pages.push('...');
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

describe('Pagination Logic', () => {
  describe('getPaginationRange', () => {
    it('should show all pages when total <= 7', () => {
      expect(getPaginationRange(1, 5)).toEqual([1, 2, 3, 4, 5]);
      expect(getPaginationRange(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it('should show ellipsis for large page counts', () => {
      const result = getPaginationRange(1, 20);
      expect(result[0]).toBe(1);
      expect(result).toContain('...');
      expect(result[result.length - 1]).toBe(20);
    });

    it('should show ellipsis on both sides when in the middle', () => {
      const result = getPaginationRange(10, 20);
      expect(result).toEqual([1, '...', 9, 10, 11, '...', 20]);
    });

    it('should show ellipsis only on right side near the start', () => {
      const result = getPaginationRange(2, 20);
      expect(result[0]).toBe(1);
      // Near start: no ellipsis before page numbers, only after
      expect(result[1]).toBe(2); // Second element should be a number, not '...'
      expect(result[result.length - 1]).toBe(20);
    });

    it('should show ellipsis only on left side near the end', () => {
      const result = getPaginationRange(19, 20);
      expect(result[0]).toBe(1);
      expect(result[result.length - 1]).toBe(20);
      // Should have ellipsis only on left
      const ellipsisCount = result.filter(x => x === '...').length;
      expect(ellipsisCount).toBe(1);
    });

    it('should handle page 1 of 1', () => {
      expect(getPaginationRange(1, 1)).toEqual([1]);
    });
  });

  describe('Pagination math', () => {
    const PAGE_SIZE = 20;

    it('should calculate correct total pages', () => {
      expect(Math.ceil(0 / PAGE_SIZE)).toBe(0);
      expect(Math.ceil(1 / PAGE_SIZE)).toBe(1);
      expect(Math.ceil(20 / PAGE_SIZE)).toBe(1);
      expect(Math.ceil(21 / PAGE_SIZE)).toBe(2);
      expect(Math.ceil(100 / PAGE_SIZE)).toBe(5);
    });

    it('should calculate correct start index for each page', () => {
      expect((1 - 1) * PAGE_SIZE).toBe(0);
      expect((2 - 1) * PAGE_SIZE).toBe(20);
      expect((3 - 1) * PAGE_SIZE).toBe(40);
    });

    it('should slice correct items for last partial page', () => {
      const items = Array.from({ length: 45 }, (_, i) => i);
      const page3 = items.slice((3 - 1) * PAGE_SIZE, (3 - 1) * PAGE_SIZE + PAGE_SIZE);
      expect(page3).toHaveLength(5); // 45 - 40 = 5
      expect(page3[0]).toBe(40);
    });
  });
});
