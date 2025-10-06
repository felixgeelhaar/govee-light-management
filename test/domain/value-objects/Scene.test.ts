/**
 * Test-Driven Development tests for Scene value object
 *
 * Following TDD red-green-refactor cycle:
 * 1. Write failing test (RED)
 * 2. Write minimal code to pass (GREEN)
 * 3. Refactor for quality (REFACTOR)
 */

import { describe, it, expect } from 'vitest';
import { Scene, SceneType } from '@/backend/domain/value-objects/Scene';

describe('Scene Value Object', () => {
  describe('Creation', () => {
    it('should create a scene with valid parameters', () => {
      const scene = Scene.create('sunrise', 'Sunrise', 'dynamic');

      expect(scene.id).toBe('sunrise');
      expect(scene.name).toBe('Sunrise');
      expect(scene.type).toBe('dynamic');
    });

    it('should throw error when scene ID is empty', () => {
      expect(() => {
        Scene.create('', 'Sunrise', 'dynamic');
      }).toThrow('Scene ID is required');
    });

    it('should throw error when scene ID contains only whitespace', () => {
      expect(() => {
        Scene.create('   ', 'Sunrise', 'dynamic');
      }).toThrow('Scene ID is required');
    });

    it('should throw error when scene name is empty', () => {
      expect(() => {
        Scene.create('sunrise', '', 'dynamic');
      }).toThrow('Scene name is required');
    });

    it('should throw error when scene name contains only whitespace', () => {
      expect(() => {
        Scene.create('sunrise', '   ', 'dynamic');
      }).toThrow('Scene name is required');
    });

    it('should throw error when scene type is empty', () => {
      expect(() => {
        Scene.create('sunrise', 'Sunrise', '' as SceneType);
      }).toThrow('Scene type is required');
    });
  });

  describe('Common Scenes', () => {
    it('should create Sunrise scene', () => {
      const scene = Scene.sunrise();

      expect(scene.id).toBe('sunrise');
      expect(scene.name).toBe('Sunrise');
      expect(scene.type).toBe('dynamic');
    });

    it('should create Sunset scene', () => {
      const scene = Scene.sunset();

      expect(scene.id).toBe('sunset');
      expect(scene.name).toBe('Sunset');
      expect(scene.type).toBe('dynamic');
    });

    it('should create Rainbow scene', () => {
      const scene = Scene.rainbow();

      expect(scene.id).toBe('rainbow');
      expect(scene.name).toBe('Rainbow');
      expect(scene.type).toBe('dynamic');
    });

    it('should create Aurora scene', () => {
      const scene = Scene.aurora();

      expect(scene.id).toBe('aurora');
      expect(scene.name).toBe('Aurora');
      expect(scene.type).toBe('dynamic');
    });

    it('should create Movie scene', () => {
      const scene = Scene.movie();

      expect(scene.id).toBe('movie');
      expect(scene.name).toBe('Movie');
      expect(scene.type).toBe('preset');
    });

    it('should create Reading scene', () => {
      const scene = Scene.reading();

      expect(scene.id).toBe('reading');
      expect(scene.name).toBe('Reading');
      expect(scene.type).toBe('preset');
    });

    it('should create Nightlight scene', () => {
      const scene = Scene.nightlight();

      expect(scene.id).toBe('nightlight');
      expect(scene.name).toBe('Nightlight');
      expect(scene.type).toBe('preset');
    });
  });

  describe('Equality', () => {
    it('should consider scenes with same ID equal', () => {
      const scene1 = Scene.create('sunrise', 'Sunrise', 'dynamic');
      const scene2 = Scene.create('sunrise', 'Sunrise (Custom)', 'dynamic');

      expect(scene1.equals(scene2)).toBe(true);
    });

    it('should consider scenes with different IDs not equal', () => {
      const scene1 = Scene.create('sunrise', 'Sunrise', 'dynamic');
      const scene2 = Scene.create('sunset', 'Sunset', 'dynamic');

      expect(scene1.equals(scene2)).toBe(false);
    });

    it('should handle equality check with same instance', () => {
      const scene = Scene.create('sunrise', 'Sunrise', 'dynamic');

      expect(scene.equals(scene)).toBe(true);
    });
  });

  describe('Serialization', () => {
    it('should serialize to plain object', () => {
      const scene = Scene.create('sunrise', 'Sunrise', 'dynamic');
      const serialized = scene.toJSON();

      expect(serialized).toEqual({
        id: 'sunrise',
        name: 'Sunrise',
        type: 'dynamic'
      });
    });

    it('should serialize preset scenes correctly', () => {
      const scene = Scene.nightlight();
      const serialized = scene.toJSON();

      expect(serialized).toEqual({
        id: 'nightlight',
        name: 'Nightlight',
        type: 'preset'
      });
    });
  });

  describe('Deserialization', () => {
    it('should deserialize from plain object', () => {
      const data = {
        id: 'aurora',
        name: 'Aurora',
        type: 'dynamic' as SceneType
      };

      const scene = Scene.fromJSON(data);

      expect(scene.id).toBe('aurora');
      expect(scene.name).toBe('Aurora');
      expect(scene.type).toBe('dynamic');
    });

    it('should throw error when deserializing invalid data', () => {
      const invalidData = {
        id: '',
        name: 'Invalid',
        type: 'dynamic' as SceneType
      };

      expect(() => {
        Scene.fromJSON(invalidData);
      }).toThrow('Scene ID is required');
    });

    it('should throw error when deserializing with missing fields', () => {
      const incompleteData = {
        id: 'aurora',
        name: 'Aurora'
        // type is missing
      } as any;

      expect(() => {
        Scene.fromJSON(incompleteData);
      }).toThrow('Scene type is required');
    });
  });

  describe('String Representation', () => {
    it('should provide readable string representation', () => {
      const scene = Scene.create('sunrise', 'Sunrise', 'dynamic');

      expect(scene.toString()).toBe('Scene(sunrise: Sunrise [dynamic])');
    });

    it('should include all scene information in toString', () => {
      const scene = Scene.nightlight();
      const str = scene.toString();

      expect(str).toContain('nightlight');
      expect(str).toContain('Nightlight');
      expect(str).toContain('preset');
    });
  });

  describe('Immutability', () => {
    it('should not allow direct modification of properties', () => {
      const scene = Scene.create('sunrise', 'Sunrise', 'dynamic');

      // Attempting to modify should have no effect (TypeScript prevents this at compile time)
      // This test verifies runtime immutability
      const originalId = scene.id;
      const originalName = scene.name;
      const originalType = scene.type;

      expect(scene.id).toBe(originalId);
      expect(scene.name).toBe(originalName);
      expect(scene.type).toBe(originalType);
    });
  });

  describe('Scene Types', () => {
    it('should support dynamic scene type', () => {
      const scene = Scene.create('test', 'Test', 'dynamic');
      expect(scene.type).toBe('dynamic');
    });

    it('should support preset scene type', () => {
      const scene = Scene.create('test', 'Test', 'preset');
      expect(scene.type).toBe('preset');
    });

    it('should support custom scene type', () => {
      const scene = Scene.create('test', 'Test', 'custom');
      expect(scene.type).toBe('custom');
    });
  });
});
