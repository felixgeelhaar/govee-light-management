/**
 * Test-Driven Development tests for MusicModeMapper
 *
 * Tests the mapping between domain MusicModeConfig and API MusicMode
 */

import { describe, it, expect } from 'vitest';
import { MusicMode } from '@felixgeelhaar/govee-api-client';
import { MusicModeConfig } from '@/backend/domain/value-objects/MusicModeConfig';
import { MusicModeMapper } from '@/backend/infrastructure/mappers/MusicModeMapper';

describe('MusicModeMapper', () => {
  describe('toApiMusicMode', () => {
    it('should map rhythm mode with correct ID (3)', () => {
      const config = MusicModeConfig.rhythm();
      const apiMode = MusicModeMapper.toApiMusicMode(config);

      expect(apiMode.modeId).toBe(3);
      expect(apiMode.sensitivity).toBe(50);
    });

    it('should map energic mode with correct ID (5)', () => {
      const config = MusicModeConfig.energic();
      const apiMode = MusicModeMapper.toApiMusicMode(config);

      expect(apiMode.modeId).toBe(5);
      expect(apiMode.sensitivity).toBe(75);
    });

    it('should map spectrum mode with correct ID (4)', () => {
      const config = MusicModeConfig.spectrum();
      const apiMode = MusicModeMapper.toApiMusicMode(config);

      expect(apiMode.modeId).toBe(4);
      expect(apiMode.sensitivity).toBe(60);
    });

    it('should map rolling mode with correct ID (6)', () => {
      const config = MusicModeConfig.rolling();
      const apiMode = MusicModeMapper.toApiMusicMode(config);

      expect(apiMode.modeId).toBe(6);
      expect(apiMode.sensitivity).toBe(50);
    });

    it('should preserve custom sensitivity values', () => {
      const config = MusicModeConfig.create(90, 'rhythm', true);
      const apiMode = MusicModeMapper.toApiMusicMode(config);

      expect(apiMode.sensitivity).toBe(90);
    });

    it('should preserve zero sensitivity', () => {
      const config = MusicModeConfig.create(0, 'spectrum', false);
      const apiMode = MusicModeMapper.toApiMusicMode(config);

      expect(apiMode.sensitivity).toBe(0);
    });

    it('should preserve maximum sensitivity (100)', () => {
      const config = MusicModeConfig.create(100, 'energic', true);
      const apiMode = MusicModeMapper.toApiMusicMode(config);

      expect(apiMode.sensitivity).toBe(100);
    });
  });

  describe('getModeId', () => {
    it('should return 3 for rhythm mode', () => {
      expect(MusicModeMapper.getModeId('rhythm')).toBe(3);
    });

    it('should return 5 for energic mode', () => {
      expect(MusicModeMapper.getModeId('energic')).toBe(5);
    });

    it('should return 4 for spectrum mode', () => {
      expect(MusicModeMapper.getModeId('spectrum')).toBe(4);
    });

    it('should return 6 for rolling mode', () => {
      expect(MusicModeMapper.getModeId('rolling')).toBe(6);
    });
  });

  describe('toApiAutoColor', () => {
    it('should convert true to 1', () => {
      expect(MusicModeMapper.toApiAutoColor(true)).toBe(1);
    });

    it('should convert false to 0', () => {
      expect(MusicModeMapper.toApiAutoColor(false)).toBe(0);
    });
  });

  describe('getAllModeIds', () => {
    it('should return all four mode IDs', () => {
      const ids = MusicModeMapper.getAllModeIds();

      expect(ids).toHaveLength(4);
      expect(ids).toContain(3); // rhythm
      expect(ids).toContain(4); // spectrum
      expect(ids).toContain(5); // energic
      expect(ids).toContain(6); // rolling
    });

    it('should not contain duplicate IDs', () => {
      const ids = MusicModeMapper.getAllModeIds();
      const uniqueIds = [...new Set(ids)];

      expect(ids.length).toBe(uniqueIds.length);
    });
  });

  describe('getModeFromId', () => {
    it('should return rhythm for ID 3', () => {
      expect(MusicModeMapper.getModeFromId(3)).toBe('rhythm');
    });

    it('should return energic for ID 5', () => {
      expect(MusicModeMapper.getModeFromId(5)).toBe('energic');
    });

    it('should return spectrum for ID 4', () => {
      expect(MusicModeMapper.getModeFromId(4)).toBe('spectrum');
    });

    it('should return rolling for ID 6', () => {
      expect(MusicModeMapper.getModeFromId(6)).toBe('rolling');
    });

    it('should return undefined for unknown ID', () => {
      expect(MusicModeMapper.getModeFromId(99)).toBeUndefined();
    });

    it('should return undefined for ID 1', () => {
      // Mode ID 1 doesn't exist in official Govee API
      expect(MusicModeMapper.getModeFromId(1)).toBeUndefined();
    });

    it('should return undefined for ID 2', () => {
      // Mode ID 2 doesn't exist in official Govee API
      expect(MusicModeMapper.getModeFromId(2)).toBeUndefined();
    });
  });

  describe('Official Govee API Mode ID Compliance', () => {
    it('should match official Govee API mode IDs', () => {
      // This test documents the official Govee API mode IDs
      // Source: developer.govee.com/reference/control-you-devices
      expect(MusicModeMapper.getModeId('rhythm')).toBe(3);
      expect(MusicModeMapper.getModeId('spectrum')).toBe(4);
      expect(MusicModeMapper.getModeId('energic')).toBe(5);
      expect(MusicModeMapper.getModeId('rolling')).toBe(6);
    });
  });
});
