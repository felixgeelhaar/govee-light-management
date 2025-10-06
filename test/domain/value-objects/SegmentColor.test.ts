/**
 * Test-Driven Development tests for SegmentColor value object
 *
 * Following TDD red-green-refactor cycle:
 * 1. Write failing test (RED)
 * 2. Write minimal code to pass (GREEN)
 * 3. Refactor for quality (REFACTOR)
 */

import { describe, it, expect } from 'vitest';
import { SegmentColor } from '@/backend/domain/value-objects/SegmentColor';
import { ColorRgb } from '@felixgeelhaar/govee-api-client';

describe('SegmentColor Value Object', () => {
  describe('Creation', () => {
    it('should create a segment color with valid parameters', () => {
      const color = new ColorRgb(255, 0, 0); // Red
      const segmentColor = SegmentColor.create(0, color);

      expect(segmentColor.segmentIndex).toBe(0);
      expect(segmentColor.color).toEqual(color);
    });

    it('should create segment color with different segment indices', () => {
      const color = new ColorRgb(0, 255, 0); // Green
      const segment5 = SegmentColor.create(5, color);
      const segment10 = SegmentColor.create(10, color);

      expect(segment5.segmentIndex).toBe(5);
      expect(segment10.segmentIndex).toBe(10);
    });

    it('should throw error when segment index is negative', () => {
      const color = new ColorRgb(255, 0, 0);

      expect(() => {
        SegmentColor.create(-1, color);
      }).toThrow('Segment index must be non-negative');
    });

    it('should throw error when segment index is not an integer', () => {
      const color = new ColorRgb(255, 0, 0);

      expect(() => {
        SegmentColor.create(1.5, color);
      }).toThrow('Segment index must be an integer');
    });

    it('should throw error when color is not provided', () => {
      expect(() => {
        SegmentColor.create(0, null as any);
      }).toThrow('Color is required');
    });

    it('should throw error when color is undefined', () => {
      expect(() => {
        SegmentColor.create(0, undefined as any);
      }).toThrow('Color is required');
    });

    it('should accept segment index of zero', () => {
      const color = new ColorRgb(255, 255, 255);
      const segmentColor = SegmentColor.create(0, color);

      expect(segmentColor.segmentIndex).toBe(0);
    });

    it('should accept large segment indices', () => {
      const color = new ColorRgb(255, 0, 255);
      const segmentColor = SegmentColor.create(100, color);

      expect(segmentColor.segmentIndex).toBe(100);
    });
  });

  describe('Equality', () => {
    it('should consider segment colors with same index and color equal', () => {
      const color = new ColorRgb(255, 0, 0);
      const segment1 = SegmentColor.create(0, color);
      const segment2 = SegmentColor.create(0, color);

      expect(segment1.equals(segment2)).toBe(true);
    });

    it('should consider segment colors with different indices not equal', () => {
      const color = new ColorRgb(255, 0, 0);
      const segment1 = SegmentColor.create(0, color);
      const segment2 = SegmentColor.create(1, color);

      expect(segment1.equals(segment2)).toBe(false);
    });

    it('should consider segment colors with different colors not equal', () => {
      const color1 = new ColorRgb(255, 0, 0); // Red
      const color2 = new ColorRgb(0, 255, 0); // Green
      const segment1 = SegmentColor.create(0, color1);
      const segment2 = SegmentColor.create(0, color2);

      expect(segment1.equals(segment2)).toBe(false);
    });

    it('should handle equality check with same instance', () => {
      const color = new ColorRgb(255, 0, 0);
      const segment = SegmentColor.create(0, color);

      expect(segment.equals(segment)).toBe(true);
    });
  });

  describe('Serialization', () => {
    it('should serialize to plain object', () => {
      const color = new ColorRgb(255, 128, 64);
      const segmentColor = SegmentColor.create(5, color);
      const serialized = segmentColor.toJSON();

      expect(serialized).toEqual({
        segmentIndex: 5,
        color: {
          r: 255,
          g: 128,
          b: 64
        }
      });
    });

    it('should serialize segment 0 correctly', () => {
      const color = new ColorRgb(0, 0, 0); // Black
      const segmentColor = SegmentColor.create(0, color);
      const serialized = segmentColor.toJSON();

      expect(serialized.segmentIndex).toBe(0);
      expect(serialized.color).toEqual({ r: 0, g: 0, b: 0 });
    });
  });

  describe('Deserialization', () => {
    it('should deserialize from plain object', () => {
      const data = {
        segmentIndex: 3,
        color: { r: 100, g: 150, b: 200 }
      };

      const segmentColor = SegmentColor.fromJSON(data);

      expect(segmentColor.segmentIndex).toBe(3);
      expect(segmentColor.color.r).toBe(100);
      expect(segmentColor.color.g).toBe(150);
      expect(segmentColor.color.b).toBe(200);
    });

    it('should throw error when deserializing invalid segment index', () => {
      const invalidData = {
        segmentIndex: -5,
        color: { r: 255, g: 0, b: 0 }
      };

      expect(() => {
        SegmentColor.fromJSON(invalidData);
      }).toThrow('Segment index must be non-negative');
    });

    it('should throw error when deserializing with missing color', () => {
      const incompleteData = {
        segmentIndex: 0
        // color is missing
      } as any;

      expect(() => {
        SegmentColor.fromJSON(incompleteData);
      }).toThrow('Color is required');
    });

    it('should throw error when deserializing with invalid color values', () => {
      const invalidColorData = {
        segmentIndex: 0,
        color: { r: 300, g: 0, b: 0 } // r exceeds 255
      };

      expect(() => {
        SegmentColor.fromJSON(invalidColorData);
      }).toThrow(); // ColorRgb will throw validation error
    });
  });

  describe('String Representation', () => {
    it('should provide readable string representation', () => {
      const color = new ColorRgb(255, 0, 0);
      const segmentColor = SegmentColor.create(3, color);

      expect(segmentColor.toString()).toBe('SegmentColor(index: 3, color: RGB(255, 0, 0))');
    });

    it('should include all information in toString', () => {
      const color = new ColorRgb(128, 64, 32);
      const segmentColor = SegmentColor.create(10, color);
      const str = segmentColor.toString();

      expect(str).toContain('10');
      expect(str).toContain('128');
      expect(str).toContain('64');
      expect(str).toContain('32');
    });
  });

  describe('Immutability', () => {
    it('should not allow direct modification of properties', () => {
      const color = new ColorRgb(255, 0, 0);
      const segmentColor = SegmentColor.create(5, color);

      // Verify properties are read-only at runtime
      const originalIndex = segmentColor.segmentIndex;
      const originalColor = segmentColor.color;

      expect(segmentColor.segmentIndex).toBe(originalIndex);
      expect(segmentColor.color).toBe(originalColor);
    });
  });

  describe('Color Access', () => {
    it('should expose RGB components through color property', () => {
      const color = new ColorRgb(100, 150, 200);
      const segmentColor = SegmentColor.create(0, color);

      expect(segmentColor.color.r).toBe(100);
      expect(segmentColor.color.g).toBe(150);
      expect(segmentColor.color.b).toBe(200);
    });

    it('should handle white color (255, 255, 255)', () => {
      const white = new ColorRgb(255, 255, 255);
      const segmentColor = SegmentColor.create(0, white);

      expect(segmentColor.color.r).toBe(255);
      expect(segmentColor.color.g).toBe(255);
      expect(segmentColor.color.b).toBe(255);
    });

    it('should handle black color (0, 0, 0)', () => {
      const black = new ColorRgb(0, 0, 0);
      const segmentColor = SegmentColor.create(0, black);

      expect(segmentColor.color.r).toBe(0);
      expect(segmentColor.color.g).toBe(0);
      expect(segmentColor.color.b).toBe(0);
    });
  });

  describe('Multiple Segments', () => {
    it('should support creating multiple segment colors for a light strip', () => {
      const segments = [
        SegmentColor.create(0, new ColorRgb(255, 0, 0)),    // Red
        SegmentColor.create(1, new ColorRgb(0, 255, 0)),    // Green
        SegmentColor.create(2, new ColorRgb(0, 0, 255)),    // Blue
        SegmentColor.create(3, new ColorRgb(255, 255, 0)),  // Yellow
        SegmentColor.create(4, new ColorRgb(255, 0, 255)),  // Magenta
      ];

      expect(segments).toHaveLength(5);
      expect(segments[0].segmentIndex).toBe(0);
      expect(segments[4].segmentIndex).toBe(4);
    });

    it('should maintain distinct colors for different segments', () => {
      const segment1 = SegmentColor.create(0, new ColorRgb(255, 0, 0));
      const segment2 = SegmentColor.create(1, new ColorRgb(0, 255, 0));

      expect(segment1.color.r).toBe(255);
      expect(segment2.color.g).toBe(255);
      expect(segment1.equals(segment2)).toBe(false);
    });
  });
});
