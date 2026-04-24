/**
 * Test-Driven Development tests for MusicModeMapper
 *
 * Tests the mapping between domain MusicModeConfig and API MusicMode
 */

import { describe, it, expect } from 'vitest';
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
});
