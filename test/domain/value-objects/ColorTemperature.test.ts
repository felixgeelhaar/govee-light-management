import { describe, it, expect } from 'vitest';
import { ColorTemperature } from '@/backend/domain/value-objects/ColorTemperature';

describe('ColorTemperature Value Object', () => {
  describe('Construction', () => {
    it('accepts a typical warm temperature', () => {
      expect(new ColorTemperature(2700).kelvin).toBe(2700);
    });

    it('accepts a typical cool temperature', () => {
      expect(new ColorTemperature(6500).kelvin).toBe(6500);
    });

    it('accepts the smallest positive integer', () => {
      expect(new ColorTemperature(1).kelvin).toBe(1);
    });

    it('throws when the temperature is zero', () => {
      expect(() => new ColorTemperature(0)).toThrow(
        'Color temperature must be greater than 0',
      );
    });

    it('throws when the temperature is negative', () => {
      expect(() => new ColorTemperature(-100)).toThrow(
        'Color temperature must be greater than 0',
      );
    });

    it('throws when the temperature is not an integer', () => {
      expect(() => new ColorTemperature(2700.5)).toThrow(
        'Color temperature must be an integer',
      );
    });

    it('throws when the temperature is NaN', () => {
      expect(() => new ColorTemperature(Number.NaN)).toThrow(
        'Color temperature must be an integer',
      );
    });
  });

  describe('Equality', () => {
    it('returns true for the same kelvin value', () => {
      expect(new ColorTemperature(4000).equals(new ColorTemperature(4000))).toBe(
        true,
      );
    });

    it('returns false for different kelvin values', () => {
      expect(new ColorTemperature(4000).equals(new ColorTemperature(4001))).toBe(
        false,
      );
    });
  });

  describe('Serialization', () => {
    it('serializes to a plain number via toJSON', () => {
      expect(new ColorTemperature(5000).toJSON()).toBe(5000);
    });

    it('serializes correctly through JSON.stringify', () => {
      expect(JSON.stringify(new ColorTemperature(3200))).toBe('3200');
    });
  });
});
