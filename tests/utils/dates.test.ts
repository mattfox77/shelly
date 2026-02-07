/**
 * Date Utilities Tests
 */

import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  daysAgo,
  weeksAgo,
  formatDate,
  formatDateHuman,
  isWithinRange,
  daysBetween,
  parseDate
} from '../../src/utils/dates';

describe('Date Utilities', () => {
  describe('startOfDay', () => {
    it('should set time to midnight', () => {
      const date = new Date('2024-01-15T14:30:45.123Z');
      const result = startOfDay(date);

      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });

    it('should not modify original date', () => {
      const date = new Date('2024-01-15T14:30:00Z');
      const originalTime = date.getTime();
      startOfDay(date);

      expect(date.getTime()).toBe(originalTime);
    });
  });

  describe('endOfDay', () => {
    it('should set time to end of day', () => {
      const date = new Date('2024-01-15T14:30:45.123Z');
      const result = endOfDay(date);

      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
      expect(result.getSeconds()).toBe(59);
      expect(result.getMilliseconds()).toBe(999);
    });
  });

  describe('startOfWeek', () => {
    it('should return Monday of the week', () => {
      // Wednesday Jan 17, 2024
      const date = new Date('2024-01-17T14:30:00Z');
      const result = startOfWeek(date);

      expect(result.getDay()).toBe(1); // Monday
      expect(result.getDate()).toBe(15); // Jan 15
    });

    it('should handle Sunday correctly', () => {
      // Sunday Jan 21, 2024
      const date = new Date('2024-01-21T14:30:00Z');
      const result = startOfWeek(date);

      expect(result.getDay()).toBe(1); // Monday
      expect(result.getDate()).toBe(15); // Jan 15 (previous Monday)
    });

    it('should set time to midnight', () => {
      const date = new Date('2024-01-17T14:30:00Z');
      const result = startOfWeek(date);

      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
    });
  });

  describe('endOfWeek', () => {
    it('should return Sunday of the week', () => {
      const date = new Date('2024-01-17T14:30:00Z');
      const result = endOfWeek(date);

      expect(result.getDay()).toBe(0); // Sunday
      expect(result.getDate()).toBe(21); // Jan 21
    });

    it('should set time to end of day', () => {
      const date = new Date('2024-01-17T14:30:00Z');
      const result = endOfWeek(date);

      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
    });
  });

  describe('daysAgo', () => {
    it('should return date N days ago', () => {
      const from = new Date('2024-01-15T12:00:00Z');
      const result = daysAgo(5, from);

      expect(result.getDate()).toBe(10);
    });

    it('should default to current date', () => {
      const result = daysAgo(1);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      expect(result.getDate()).toBe(yesterday.getDate());
    });
  });

  describe('weeksAgo', () => {
    it('should return date N weeks ago', () => {
      const from = new Date('2024-01-15T12:00:00Z');
      const result = weeksAgo(2, from);

      expect(result.getDate()).toBe(1);
      expect(result.getMonth()).toBe(0); // January
    });
  });

  describe('formatDate', () => {
    it('should format as ISO date string', () => {
      const date = new Date('2024-01-15T14:30:00Z');
      const result = formatDate(date);

      expect(result).toBe('2024-01-15');
    });
  });

  describe('formatDateHuman', () => {
    it('should format as human-readable string', () => {
      const date = new Date('2024-01-15T14:30:00Z');
      const result = formatDateHuman(date);

      expect(result).toContain('2024');
      expect(result).toContain('Jan');
      expect(result).toContain('15');
    });
  });

  describe('isWithinRange', () => {
    it('should return true if date is within range', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      const start = new Date('2024-01-10T00:00:00Z');
      const end = new Date('2024-01-20T00:00:00Z');

      expect(isWithinRange(date, start, end)).toBe(true);
    });

    it('should return false if date is outside range', () => {
      const date = new Date('2024-01-25T12:00:00Z');
      const start = new Date('2024-01-10T00:00:00Z');
      const end = new Date('2024-01-20T00:00:00Z');

      expect(isWithinRange(date, start, end)).toBe(false);
    });

    it('should return true if date equals start', () => {
      const date = new Date('2024-01-10T00:00:00Z');
      const start = new Date('2024-01-10T00:00:00Z');
      const end = new Date('2024-01-20T00:00:00Z');

      expect(isWithinRange(date, start, end)).toBe(true);
    });
  });

  describe('daysBetween', () => {
    it('should calculate days between dates', () => {
      const start = new Date('2024-01-10T00:00:00Z');
      const end = new Date('2024-01-15T00:00:00Z');

      expect(daysBetween(start, end)).toBe(5);
    });

    it('should handle reverse order', () => {
      const start = new Date('2024-01-15T00:00:00Z');
      const end = new Date('2024-01-10T00:00:00Z');

      expect(daysBetween(start, end)).toBe(5);
    });
  });

  describe('parseDate', () => {
    it('should parse valid date string', () => {
      const result = parseDate('2024-01-15T12:00:00Z');

      expect(result.getUTCFullYear()).toBe(2024);
      expect(result.getUTCMonth()).toBe(0); // January
      expect(result.getUTCDate()).toBe(15);
    });

    it('should return current date for undefined', () => {
      const result = parseDate(undefined);
      const now = new Date();

      expect(result.getDate()).toBe(now.getDate());
    });

    it('should return current date for invalid string', () => {
      const result = parseDate('not-a-date');
      const now = new Date();

      expect(result.getDate()).toBe(now.getDate());
    });
  });
});
