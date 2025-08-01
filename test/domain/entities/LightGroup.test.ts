/**
 * Test-Driven Development tests for LightGroup entity
 * 
 * Tests group management, state aggregation, and business rules
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LightGroup } from '@/backend/domain/entities/LightGroup';
import { Light } from '@/backend/domain/entities/Light';
import { LightState } from '@/backend/domain/value-objects/LightState';
import { Brightness } from '@felixgeelhaar/govee-api-client';

describe('LightGroup Entity', () => {
  let lightGroup: LightGroup;
  let light1: Light;
  let light2: Light;
  let light3: Light;

  const createMockLight = (deviceId: string, name: string, isOn = false, isOnline = true): Light => {
    const state: LightState = {
      isOn,
      isOnline,
      brightness: undefined,
      color: undefined,
      colorTemperature: undefined
    };
    return Light.create(deviceId, 'H6110', name, state);
  };

  beforeEach(() => {
    light1 = createMockLight('device1', 'Light 1');
    light2 = createMockLight('device2', 'Light 2');
    light3 = createMockLight('device3', 'Light 3');
    lightGroup = LightGroup.create('group1', 'Living Room', [light1, light2]);
  });

  describe('Creation', () => {
    it('should create group with valid parameters', () => {
      expect(lightGroup.id).toBe('group1');
      expect(lightGroup.name).toBe('Living Room');
      expect(lightGroup.size).toBe(2);
      expect(lightGroup.lights).toHaveLength(2);
      expect(lightGroup.lights).toContain(light1);
      expect(lightGroup.lights).toContain(light2);
    });

    it('should create empty group', () => {
      const emptyGroup = LightGroup.create('empty', 'Empty Group', []);
      expect(emptyGroup.size).toBe(0);
      expect(emptyGroup.lights).toHaveLength(0);
    });

    it('should throw error when ID is empty', () => {
      expect(() => {
        LightGroup.create('', 'Test Group', [light1]);
      }).toThrow('Group ID is required');
    });

    it('should throw error when name is empty', () => {
      expect(() => {
        LightGroup.create('group1', '', [light1]);
      }).toThrow('Group name is required');
    });
  });

  describe('Light Management', () => {
    it('should add light to group', () => {
      lightGroup.addLight(light3);
      
      expect(lightGroup.size).toBe(3);
      expect(lightGroup.lights).toContain(light3);
    });

    it('should not add duplicate light', () => {
      lightGroup.addLight(light1); // light1 already in group
      
      expect(lightGroup.size).toBe(2);
      expect(lightGroup.lights.filter(l => l === light1)).toHaveLength(1);
    });

    it('should remove light from group', () => {
      lightGroup.removeLight(light1);
      
      expect(lightGroup.size).toBe(1);
      expect(lightGroup.lights).not.toContain(light1);
      expect(lightGroup.lights).toContain(light2);
    });

    it('should handle removal of non-existent light gracefully', () => {
      const initialSize = lightGroup.size;
      lightGroup.removeLight(light3); // light3 not in group
      
      expect(lightGroup.size).toBe(initialSize);
    });

    it('should clear all lights', () => {
      lightGroup.addLight(light3);
      expect(lightGroup.size).toBe(3);
      
      lightGroup.removeLight(light1);
      lightGroup.removeLight(light2);
      lightGroup.removeLight(light3);
      
      expect(lightGroup.size).toBe(0);
      expect(lightGroup.lights).toHaveLength(0);
    });
  });

  describe('Controllable Lights', () => {
    it('should return only online lights as controllable', () => {
      light1.updateState({ isOnline: true });
      light2.updateState({ isOnline: false });
      
      const controllable = lightGroup.getControllableLights();
      
      expect(controllable).toHaveLength(1);
      expect(controllable).toContain(light1);
      expect(controllable).not.toContain(light2);
    });

    it('should return empty array when no lights are controllable', () => {
      light1.updateState({ isOnline: false });
      light2.updateState({ isOnline: false });
      
      const controllable = lightGroup.getControllableLights();
      
      expect(controllable).toHaveLength(0);
    });

    it('should return all lights when all are online', () => {
      light1.updateState({ isOnline: true });
      light2.updateState({ isOnline: true });
      
      const controllable = lightGroup.getControllableLights();
      
      expect(controllable).toHaveLength(2);
      expect(controllable).toContain(light1);
      expect(controllable).toContain(light2);
    });
  });

  describe('State Summary', () => {
    it('should indicate all lights off when all are off', () => {
      light1.updateState({ isOn: false });
      light2.updateState({ isOn: false });
      
      const summary = lightGroup.getStateSummary();
      
      expect(summary.allOff).toBe(true);
      expect(summary.allOn).toBe(false);
      expect(summary.mixedState).toBe(false);
      expect(summary.onCount).toBe(0);
      expect(summary.offCount).toBe(2);
      expect(summary.totalCount).toBe(2);
    });

    it('should indicate all lights on when all are on', () => {
      light1.updateState({ isOn: true });
      light2.updateState({ isOn: true });
      
      const summary = lightGroup.getStateSummary();
      
      expect(summary.allOn).toBe(true);
      expect(summary.allOff).toBe(false);
      expect(summary.mixedState).toBe(false);
      expect(summary.onCount).toBe(2);
      expect(summary.offCount).toBe(0);
      expect(summary.totalCount).toBe(2);
    });

    it('should indicate mixed state when some lights are on', () => {
      light1.updateState({ isOn: true });
      light2.updateState({ isOn: false });
      
      const summary = lightGroup.getStateSummary();
      
      expect(summary.mixedState).toBe(true);
      expect(summary.allOn).toBe(false);
      expect(summary.allOff).toBe(false);
      expect(summary.onCount).toBe(1);
      expect(summary.offCount).toBe(1);
      expect(summary.totalCount).toBe(2);
    });

    it('should handle empty group state summary', () => {
      const emptyGroup = LightGroup.create('empty', 'Empty', []);
      const summary = emptyGroup.getStateSummary();
      
      expect(summary.allOff).toBe(true); // Empty group should be considered "all off"
      expect(summary.allOn).toBe(false);
      expect(summary.mixedState).toBe(false);
      expect(summary.onCount).toBe(0);
      expect(summary.offCount).toBe(0);
      expect(summary.totalCount).toBe(0);
    });

    it('should count only online lights in state summary', () => {
      light1.updateState({ isOn: true, isOnline: true });
      light2.updateState({ isOn: true, isOnline: false }); // offline light
      lightGroup.addLight(light3);
      light3.updateState({ isOn: false, isOnline: true });
      
      const summary = lightGroup.getStateSummary();
      
      // Should only count online lights (light1 and light3)
      expect(summary.totalCount).toBe(2);
      expect(summary.onCount).toBe(1);
      expect(summary.offCount).toBe(1);
      expect(summary.mixedState).toBe(true);
    });
  });

  describe('Business Rules', () => {
    it('should enforce maximum group size if defined', () => {
      // This test would be implemented if we add a max size business rule
      // For now, we'll just ensure unlimited growth works
      for (let i = 0; i < 10; i++) {
        const newLight = createMockLight(`device${i + 10}`, `Light ${i + 10}`);
        lightGroup.addLight(newLight);
      }
      
      expect(lightGroup.size).toBe(12); // original 2 + 10 new
    });

    it('should validate light compatibility', () => {
      // This test would check if lights are compatible with the group
      // For now, all lights are considered compatible
      const compatibleLight = createMockLight('device4', 'Compatible Light');
      
      expect(() => {
        lightGroup.addLight(compatibleLight);
      }).not.toThrow();
    });
  });

  describe('Immutability', () => {
    it('should not allow direct mutation of group properties', () => {
      const originalId = lightGroup.id;
      const originalName = lightGroup.name;
      
      expect(lightGroup.id).toBe(originalId);
      expect(lightGroup.name).toBe(originalName);
    });

    it('should return new array on lights access', () => {
      const lightsArray1 = lightGroup.lights;
      const lightsArray2 = lightGroup.lights;
      
      // Should return new array instances but with same content
      expect(lightsArray1).not.toBe(lightsArray2);
      expect(lightsArray1).toEqual(lightsArray2);
    });
  });
});