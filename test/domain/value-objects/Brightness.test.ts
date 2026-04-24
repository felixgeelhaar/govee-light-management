import { describe, it, expect } from 'vitest';
import { Brightness } from '@/backend/domain/value-objects/Brightness';

describe('Brightness Value Object', () => {
  describe('Construction', () => {
    it('accepts the minimum level (0)', () => {
      expect(new Brightness(0).level).toBe(0);
    });

    it('accepts the maximum level (100)', () => {
      expect(new Brightness(100).level).toBe(100);
    });

    it('accepts a mid-range level', () => {
      expect(new Brightness(42).level).toBe(42);
    });

    it('throws when the level is below 0', () => {
      expect(() => new Brightness(-1)).toThrow(
        'Brightness level must be between 0 and 100',
      );
    });

    it('throws when the level is above 100', () => {
      expect(() => new Brightness(101)).toThrow(
        'Brightness level must be between 0 and 100',
      );
    });

    it('throws when the level is not an integer', () => {
      expect(() => new Brightness(42.5)).toThrow(
        'Brightness level must be an integer',
      );
    });

    it('throws when the level is NaN', () => {
      expect(() => new Brightness(Number.NaN)).toThrow(
        'Brightness level must be an integer',
      );
    });
  });

  describe('Equality', () => {
    it('returns true for brightness objects with the same level', () => {
      expect(new Brightness(50).equals(new Brightness(50))).toBe(true);
    });

    it('returns false for brightness objects with different levels', () => {
      expect(new Brightness(50).equals(new Brightness(51))).toBe(false);
    });
  });

  describe('Serialization', () => {
    it('serializes to a plain number via toJSON', () => {
      expect(new Brightness(75).toJSON()).toBe(75);
    });

    it('serializes correctly through JSON.stringify', () => {
      expect(JSON.stringify(new Brightness(33))).toBe('33');
    });
  });
});
