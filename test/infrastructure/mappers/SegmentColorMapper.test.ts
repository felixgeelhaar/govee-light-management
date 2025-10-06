/**
 * Test-Driven Development tests for SegmentColorMapper
 *
 * Tests the mapping between domain SegmentColor and API SegmentColor
 */

import { describe, it, expect } from 'vitest';
import { SegmentColor as ApiSegmentColor, ColorRgb } from '@felixgeelhaar/govee-api-client';
import { SegmentColor as DomainSegmentColor } from '@/backend/domain/value-objects/SegmentColor';
import { SegmentColorMapper } from '@/backend/infrastructure/mappers/SegmentColorMapper';

describe('SegmentColorMapper', () => {
  describe('toApiSegmentColor', () => {
    it('should map segment 0 with red color', () => {
      const color = ColorRgb.fromHex('#FF0000');
      const domainSegment = DomainSegmentColor.create(0, color);

      const apiSegment = SegmentColorMapper.toApiSegmentColor(domainSegment);

      expect(apiSegment.index).toBe(0);
      expect(apiSegment.color).toBe(color);
    });

    it('should map segment 14 with blue color', () => {
      const color = ColorRgb.fromHex('#0000FF');
      const domainSegment = DomainSegmentColor.create(14, color);

      const apiSegment = SegmentColorMapper.toApiSegmentColor(domainSegment);

      expect(apiSegment.index).toBe(14);
      expect(apiSegment.color).toBe(color);
    });

    it('should preserve RGB color values', () => {
      const color = ColorRgb.fromHex('#A1B2C3');
      const domainSegment = DomainSegmentColor.create(5, color);

      const apiSegment = SegmentColorMapper.toApiSegmentColor(domainSegment);

      expect(apiSegment.color.r).toBe(color.r);
      expect(apiSegment.color.g).toBe(color.g);
      expect(apiSegment.color.b).toBe(color.b);
    });

    it('should not set brightness (domain layer does not support it)', () => {
      const color = ColorRgb.fromHex('#00FF00');
      const domainSegment = DomainSegmentColor.create(3, color);

      const apiSegment = SegmentColorMapper.toApiSegmentColor(domainSegment);

      expect(apiSegment.brightness).toBeUndefined();
    });
  });

  describe('toApiSegmentColors', () => {
    it('should map multiple segments correctly', () => {
      const segments = [
        DomainSegmentColor.create(0, ColorRgb.fromHex('#FF0000')),
        DomainSegmentColor.create(1, ColorRgb.fromHex('#00FF00')),
        DomainSegmentColor.create(2, ColorRgb.fromHex('#0000FF')),
      ];

      const apiSegments = SegmentColorMapper.toApiSegmentColors(segments);

      expect(apiSegments).toHaveLength(3);
      expect(apiSegments[0].index).toBe(0);
      expect(apiSegments[1].index).toBe(1);
      expect(apiSegments[2].index).toBe(2);
    });

    it('should preserve order of segments', () => {
      const segments = [
        DomainSegmentColor.create(5, ColorRgb.fromHex('#FFFFFF')),
        DomainSegmentColor.create(2, ColorRgb.fromHex('#000000')),
        DomainSegmentColor.create(8, ColorRgb.fromHex('#808080')),
      ];

      const apiSegments = SegmentColorMapper.toApiSegmentColors(segments);

      expect(apiSegments[0].index).toBe(5);
      expect(apiSegments[1].index).toBe(2);
      expect(apiSegments[2].index).toBe(8);
    });

    it('should handle empty array', () => {
      const apiSegments = SegmentColorMapper.toApiSegmentColors([]);

      expect(apiSegments).toEqual([]);
    });
  });

  describe('toDomainSegmentColor', () => {
    it('should convert API segment back to domain segment', () => {
      const color = ColorRgb.fromHex('#FF8800');
      const apiSegment = new ApiSegmentColor(7, color);

      const domainSegment = SegmentColorMapper.toDomainSegmentColor(apiSegment);

      expect(domainSegment.segmentIndex).toBe(7);
      expect(domainSegment.color).toBe(color);
    });

    it('should handle API segment with brightness', () => {
      const color = ColorRgb.fromHex('#FF0000');
      const brightness = { value: 75 };
      const apiSegment = new ApiSegmentColor(3, color, brightness as any);

      const domainSegment = SegmentColorMapper.toDomainSegmentColor(apiSegment);

      // Domain layer doesn't support brightness, so it should just be ignored
      expect(domainSegment.segmentIndex).toBe(3);
      expect(domainSegment.color).toBe(color);
    });
  });

  describe('toDomainSegmentColors', () => {
    it('should convert multiple API segments to domain segments', () => {
      const apiSegments = [
        new ApiSegmentColor(0, ColorRgb.fromHex('#FF0000')),
        new ApiSegmentColor(1, ColorRgb.fromHex('#00FF00')),
        new ApiSegmentColor(2, ColorRgb.fromHex('#0000FF')),
      ];

      const domainSegments = SegmentColorMapper.toDomainSegmentColors(apiSegments);

      expect(domainSegments).toHaveLength(3);
      expect(domainSegments[0].segmentIndex).toBe(0);
      expect(domainSegments[1].segmentIndex).toBe(1);
      expect(domainSegments[2].segmentIndex).toBe(2);
    });

    it('should handle empty array', () => {
      const domainSegments = SegmentColorMapper.toDomainSegmentColors([]);

      expect(domainSegments).toEqual([]);
    });
  });

  describe('Round-trip conversion', () => {
    it('should preserve data through domain → API → domain conversion', () => {
      const originalColor = ColorRgb.fromHex('#123456');
      const originalSegment = DomainSegmentColor.create(9, originalColor);

      const apiSegment = SegmentColorMapper.toApiSegmentColor(originalSegment);
      const finalSegment = SegmentColorMapper.toDomainSegmentColor(apiSegment);

      expect(finalSegment.segmentIndex).toBe(originalSegment.segmentIndex);
      expect(finalSegment.color.r).toBe(originalSegment.color.r);
      expect(finalSegment.color.g).toBe(originalSegment.color.g);
      expect(finalSegment.color.b).toBe(originalSegment.color.b);
    });
  });
});
