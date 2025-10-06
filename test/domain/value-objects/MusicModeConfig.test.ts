/**
 * Test-Driven Development tests for MusicModeConfig value object
 *
 * Following TDD red-green-refactor cycle:
 * 1. Write failing test (RED)
 * 2. Write minimal code to pass (GREEN)
 * 3. Refactor for quality (REFACTOR)
 */

import { describe, it, expect } from 'vitest';
import { MusicModeConfig, MusicModeType } from '@/backend/domain/value-objects/MusicModeConfig';

describe('MusicModeConfig Value Object', () => {
  describe('Creation', () => {
    it('should create music mode config with valid parameters', () => {
      const config = MusicModeConfig.create(75, 'rhythm', true);

      expect(config.sensitivity).toBe(75);
      expect(config.mode).toBe('rhythm');
      expect(config.autoColor).toBe(true);
    });

    it('should create config with autoColor false', () => {
      const config = MusicModeConfig.create(50, 'energic', false);

      expect(config.sensitivity).toBe(50);
      expect(config.mode).toBe('energic');
      expect(config.autoColor).toBe(false);
    });

    it('should throw error when sensitivity is below 0', () => {
      expect(() => {
        MusicModeConfig.create(-1, 'rhythm', true);
      }).toThrow('Sensitivity must be between 0 and 100');
    });

    it('should throw error when sensitivity is above 100', () => {
      expect(() => {
        MusicModeConfig.create(101, 'rhythm', true);
      }).toThrow('Sensitivity must be between 0 and 100');
    });

    it('should throw error when sensitivity is not an integer', () => {
      expect(() => {
        MusicModeConfig.create(75.5, 'rhythm', true);
      }).toThrow('Sensitivity must be an integer');
    });

    it('should accept sensitivity of 0', () => {
      const config = MusicModeConfig.create(0, 'rhythm', true);
      expect(config.sensitivity).toBe(0);
    });

    it('should accept sensitivity of 100', () => {
      const config = MusicModeConfig.create(100, 'rhythm', true);
      expect(config.sensitivity).toBe(100);
    });

    it('should throw error when mode is empty', () => {
      expect(() => {
        MusicModeConfig.create(50, '' as MusicModeType, true);
      }).toThrow('Music mode is required');
    });
  });

  describe('Predefined Configs', () => {
    it('should create rhythm mode config', () => {
      const config = MusicModeConfig.rhythm();

      expect(config.mode).toBe('rhythm');
      expect(config.sensitivity).toBe(50); // Default sensitivity
      expect(config.autoColor).toBe(true);
    });

    it('should create energic mode config', () => {
      const config = MusicModeConfig.energic();

      expect(config.mode).toBe('energic');
      expect(config.sensitivity).toBe(75); // Higher sensitivity for energic
      expect(config.autoColor).toBe(true);
    });

    it('should create spectrum mode config', () => {
      const config = MusicModeConfig.spectrum();

      expect(config.mode).toBe('spectrum');
      expect(config.sensitivity).toBe(60);
      expect(config.autoColor).toBe(true);
    });

    it('should create rolling mode config', () => {
      const config = MusicModeConfig.rolling();

      expect(config.mode).toBe('rolling');
      expect(config.sensitivity).toBe(50);
      expect(config.autoColor).toBe(true);
    });
  });

  describe('Equality', () => {
    it('should consider configs with same properties equal', () => {
      const config1 = MusicModeConfig.create(75, 'rhythm', true);
      const config2 = MusicModeConfig.create(75, 'rhythm', true);

      expect(config1.equals(config2)).toBe(true);
    });

    it('should consider configs with different sensitivity not equal', () => {
      const config1 = MusicModeConfig.create(75, 'rhythm', true);
      const config2 = MusicModeConfig.create(50, 'rhythm', true);

      expect(config1.equals(config2)).toBe(false);
    });

    it('should consider configs with different modes not equal', () => {
      const config1 = MusicModeConfig.create(75, 'rhythm', true);
      const config2 = MusicModeConfig.create(75, 'energic', true);

      expect(config1.equals(config2)).toBe(false);
    });

    it('should consider configs with different autoColor not equal', () => {
      const config1 = MusicModeConfig.create(75, 'rhythm', true);
      const config2 = MusicModeConfig.create(75, 'rhythm', false);

      expect(config1.equals(config2)).toBe(false);
    });

    it('should handle equality check with same instance', () => {
      const config = MusicModeConfig.create(75, 'rhythm', true);

      expect(config.equals(config)).toBe(true);
    });
  });

  describe('Serialization', () => {
    it('should serialize to plain object', () => {
      const config = MusicModeConfig.create(75, 'rhythm', true);
      const serialized = config.toJSON();

      expect(serialized).toEqual({
        sensitivity: 75,
        mode: 'rhythm',
        autoColor: true
      });
    });

    it('should serialize config with autoColor false', () => {
      const config = MusicModeConfig.create(50, 'energic', false);
      const serialized = config.toJSON();

      expect(serialized.autoColor).toBe(false);
    });
  });

  describe('Deserialization', () => {
    it('should deserialize from plain object', () => {
      const data = {
        sensitivity: 60,
        mode: 'spectrum' as MusicModeType,
        autoColor: true
      };

      const config = MusicModeConfig.fromJSON(data);

      expect(config.sensitivity).toBe(60);
      expect(config.mode).toBe('spectrum');
      expect(config.autoColor).toBe(true);
    });

    it('should throw error when deserializing invalid sensitivity', () => {
      const invalidData = {
        sensitivity: 150,
        mode: 'rhythm' as MusicModeType,
        autoColor: true
      };

      expect(() => {
        MusicModeConfig.fromJSON(invalidData);
      }).toThrow('Sensitivity must be between 0 and 100');
    });

    it('should throw error when deserializing with missing fields', () => {
      const incompleteData = {
        sensitivity: 50,
        mode: 'rhythm' as MusicModeType
        // autoColor is missing
      } as any;

      expect(() => {
        MusicModeConfig.fromJSON(incompleteData);
      }).toThrow();
    });
  });

  describe('String Representation', () => {
    it('should provide readable string representation', () => {
      const config = MusicModeConfig.create(75, 'rhythm', true);

      expect(config.toString()).toBe('MusicModeConfig(mode: rhythm, sensitivity: 75%, autoColor: true)');
    });

    it('should include all information in toString', () => {
      const config = MusicModeConfig.create(50, 'energic', false);
      const str = config.toString();

      expect(str).toContain('energic');
      expect(str).toContain('50');
      expect(str).toContain('false');
    });
  });

  describe('Immutability', () => {
    it('should not allow direct modification of properties', () => {
      const config = MusicModeConfig.create(75, 'rhythm', true);

      // Verify properties are read-only at runtime
      const originalSensitivity = config.sensitivity;
      const originalMode = config.mode;
      const originalAutoColor = config.autoColor;

      expect(config.sensitivity).toBe(originalSensitivity);
      expect(config.mode).toBe(originalMode);
      expect(config.autoColor).toBe(originalAutoColor);
    });
  });

  describe('Music Mode Types', () => {
    it('should support rhythm mode type', () => {
      const config = MusicModeConfig.create(50, 'rhythm', true);
      expect(config.mode).toBe('rhythm');
    });

    it('should support energic mode type', () => {
      const config = MusicModeConfig.create(50, 'energic', true);
      expect(config.mode).toBe('energic');
    });

    it('should support spectrum mode type', () => {
      const config = MusicModeConfig.create(50, 'spectrum', true);
      expect(config.mode).toBe('spectrum');
    });

    it('should support rolling mode type', () => {
      const config = MusicModeConfig.create(50, 'rolling', true);
      expect(config.mode).toBe('rolling');
    });
  });

  describe('Sensitivity Levels', () => {
    it('should handle low sensitivity (0-33)', () => {
      const config = MusicModeConfig.create(25, 'rhythm', true);
      expect(config.sensitivity).toBe(25);
    });

    it('should handle medium sensitivity (34-66)', () => {
      const config = MusicModeConfig.create(50, 'rhythm', true);
      expect(config.sensitivity).toBe(50);
    });

    it('should handle high sensitivity (67-100)', () => {
      const config = MusicModeConfig.create(90, 'rhythm', true);
      expect(config.sensitivity).toBe(90);
    });
  });
});
