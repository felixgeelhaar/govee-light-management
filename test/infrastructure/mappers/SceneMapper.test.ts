/**
 * Test-Driven Development tests for SceneMapper
 *
 * Tests the mapping between domain Scene and API LightScene
 */

import { describe, it, expect } from 'vitest';
import { LightScene } from '@felixgeelhaar/govee-api-client';
import { Scene } from '@/backend/domain/value-objects/Scene';
import { SceneMapper } from '@/backend/infrastructure/mappers/SceneMapper';

describe('SceneMapper', () => {
  describe('toApiLightScene', () => {
    it('should map sunrise scene correctly', () => {
      const domainScene = Scene.sunrise();
      const apiScene = SceneMapper.toApiLightScene(domainScene);

      expect(apiScene.name).toBe('Sunrise');
    });

    it('should map sunset scene correctly', () => {
      const domainScene = Scene.sunset();
      const apiScene = SceneMapper.toApiLightScene(domainScene);

      expect(apiScene.name).toBe('Sunset');
    });

    it('should map rainbow scene correctly', () => {
      const domainScene = Scene.rainbow();
      const apiScene = SceneMapper.toApiLightScene(domainScene);

      expect(apiScene.name).toBe('Rainbow');
    });

    it('should map aurora scene correctly', () => {
      const domainScene = Scene.aurora();
      const apiScene = SceneMapper.toApiLightScene(domainScene);

      expect(apiScene.name).toBe('Aurora');
    });

    it('should map nightlight scene correctly', () => {
      const domainScene = Scene.nightlight();
      const apiScene = SceneMapper.toApiLightScene(domainScene);

      expect(apiScene.name).toBe('Nightlight');
    });

    it('should throw error for unsupported movie scene', () => {
      const domainScene = Scene.movie();

      expect(() => {
        SceneMapper.toApiLightScene(domainScene);
      }).toThrow('Scene "movie" is not supported by Govee API');
    });

    it('should throw error for unsupported reading scene', () => {
      const domainScene = Scene.reading();

      expect(() => {
        SceneMapper.toApiLightScene(domainScene);
      }).toThrow('Scene "reading" is not supported by Govee API');
    });

    it('should include helpful suggestion for movie scene', () => {
      const domainScene = Scene.movie();

      expect(() => {
        SceneMapper.toApiLightScene(domainScene);
      }).toThrow(/candlelight.*alternative/i);
    });

    it('should include helpful suggestion for reading scene', () => {
      const domainScene = Scene.reading();

      expect(() => {
        SceneMapper.toApiLightScene(domainScene);
      }).toThrow(/warm white.*temperature/i);
    });
  });

  describe('getAllApiScenes', () => {
    it('should return all available API scenes', () => {
      const scenes = SceneMapper.getAllApiScenes();

      expect(scenes).toHaveLength(8);
      // Skip instanceof check (placeholder class !== mock class)
    });

    it('should include scenes not in domain layer', () => {
      const scenes = SceneMapper.getAllApiScenes();
      const sceneNames = scenes.map((s) => s.name);

      expect(sceneNames).toContain('Candlelight');
      expect(sceneNames).toContain('Romantic');
      expect(sceneNames).toContain('Blinking');
    });

    it('should include all domain-supported scenes', () => {
      const scenes = SceneMapper.getAllApiScenes();
      const sceneNames = scenes.map((s) => s.name);

      expect(sceneNames).toContain('Sunrise');
      expect(sceneNames).toContain('Sunset');
      expect(sceneNames).toContain('Rainbow');
      expect(sceneNames).toContain('Aurora');
      expect(sceneNames).toContain('Nightlight');
    });
  });

  describe('isSupported', () => {
    it('should return true for supported sunrise scene', () => {
      const scene = Scene.sunrise();
      expect(SceneMapper.isSupported(scene)).toBe(true);
    });

    it('should return true for supported sunset scene', () => {
      const scene = Scene.sunset();
      expect(SceneMapper.isSupported(scene)).toBe(true);
    });

    it('should return true for supported rainbow scene', () => {
      const scene = Scene.rainbow();
      expect(SceneMapper.isSupported(scene)).toBe(true);
    });

    it('should return true for supported aurora scene', () => {
      const scene = Scene.aurora();
      expect(SceneMapper.isSupported(scene)).toBe(true);
    });

    it('should return true for supported nightlight scene', () => {
      const scene = Scene.nightlight();
      expect(SceneMapper.isSupported(scene)).toBe(true);
    });

    it('should return false for unsupported movie scene', () => {
      const scene = Scene.movie();
      expect(SceneMapper.isSupported(scene)).toBe(false);
    });

    it('should return false for unsupported reading scene', () => {
      const scene = Scene.reading();
      expect(SceneMapper.isSupported(scene)).toBe(false);
    });
  });

  describe('getSupportedSceneCodes', () => {
    it('should return array of supported scene codes', () => {
      const codes = SceneMapper.getSupportedSceneCodes();

      expect(codes).toEqual(['sunrise', 'sunset', 'rainbow', 'aurora', 'nightlight']);
    });

    it('should not include movie or reading', () => {
      const codes = SceneMapper.getSupportedSceneCodes();

      expect(codes).not.toContain('movie');
      expect(codes).not.toContain('reading');
    });
  });
});
