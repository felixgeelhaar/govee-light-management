import { describe, it, expect } from 'vitest';
import { ColorRgb } from '@/backend/domain/value-objects/ColorRgb';

describe('ColorRgb Value Object', () => {
  describe('Construction', () => {
    it('accepts all-zero channels (black)', () => {
      const color = new ColorRgb(0, 0, 0);
      expect(color.r).toBe(0);
      expect(color.g).toBe(0);
      expect(color.b).toBe(0);
    });

    it('accepts all-max channels (white)', () => {
      const color = new ColorRgb(255, 255, 255);
      expect(color.r).toBe(255);
      expect(color.g).toBe(255);
      expect(color.b).toBe(255);
    });

    it('throws when red is out of range', () => {
      expect(() => new ColorRgb(256, 0, 0)).toThrow(
        'Color channel r must be between 0 and 255',
      );
    });

    it('throws when green is out of range', () => {
      expect(() => new ColorRgb(0, -1, 0)).toThrow(
        'Color channel g must be between 0 and 255',
      );
    });

    it('throws when blue is out of range', () => {
      expect(() => new ColorRgb(0, 0, 1000)).toThrow(
        'Color channel b must be between 0 and 255',
      );
    });

    it('throws when a channel is not an integer', () => {
      expect(() => new ColorRgb(12.5, 0, 0)).toThrow(
        'Color channel r must be an integer',
      );
    });
  });

  describe('fromHex', () => {
    it('parses a 6-digit hex string without prefix', () => {
      const color = ColorRgb.fromHex('ff8040');
      expect(color.r).toBe(255);
      expect(color.g).toBe(128);
      expect(color.b).toBe(64);
    });

    it('parses a 6-digit hex string with leading #', () => {
      const color = ColorRgb.fromHex('#00ff00');
      expect(color.r).toBe(0);
      expect(color.g).toBe(255);
      expect(color.b).toBe(0);
    });

    it('is case-insensitive', () => {
      expect(ColorRgb.fromHex('ABCDEF').equals(ColorRgb.fromHex('abcdef'))).toBe(
        true,
      );
    });

    it('trims surrounding whitespace', () => {
      expect(ColorRgb.fromHex('  #112233  ').r).toBe(0x11);
    });

    it('throws for a short hex string', () => {
      expect(() => ColorRgb.fromHex('abc')).toThrow(
        'Hex color must be a 6-digit RGB value',
      );
    });

    it('throws for non-hex characters', () => {
      expect(() => ColorRgb.fromHex('zzzzzz')).toThrow(
        'Hex color must be a 6-digit RGB value',
      );
    });
  });

  describe('fromObject', () => {
    it('builds a ColorRgb from an { r, g, b } object', () => {
      const color = ColorRgb.fromObject({ r: 10, g: 20, b: 30 });
      expect(color.r).toBe(10);
      expect(color.g).toBe(20);
      expect(color.b).toBe(30);
    });

    it('propagates validation errors', () => {
      expect(() => ColorRgb.fromObject({ r: 300, g: 0, b: 0 })).toThrow(
        'Color channel r must be between 0 and 255',
      );
    });
  });

  describe('Equality', () => {
    it('returns true for identical channels', () => {
      expect(new ColorRgb(1, 2, 3).equals(new ColorRgb(1, 2, 3))).toBe(true);
    });

    it('returns false when any channel differs', () => {
      expect(new ColorRgb(1, 2, 3).equals(new ColorRgb(1, 2, 4))).toBe(false);
    });
  });

  describe('Serialization', () => {
    it('serializes to a plain { r, g, b } object', () => {
      expect(new ColorRgb(10, 20, 30).toJSON()).toEqual({
        r: 10,
        g: 20,
        b: 30,
      });
    });
  });
});
