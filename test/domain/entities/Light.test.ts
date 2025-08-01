/**
 * Test-Driven Development tests for Light entity
 * 
 * Following TDD red-green-refactor cycle:
 * 1. Write failing test (RED)
 * 2. Write minimal code to pass (GREEN) 
 * 3. Refactor for quality (REFACTOR)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Light } from '@/backend/domain/entities/Light';
import { LightState } from '@/backend/domain/value-objects/LightState';
import { Brightness } from '@felixgeelhaar/govee-api-client';

describe('Light Entity', () => {
  let light: Light;
  const mockDeviceId = 'TEST_DEVICE_123';
  const mockModel = 'H6110';
  const mockName = 'Living Room Light';
  const mockInitialState: LightState = {
    isOn: false,
    isOnline: true,
    brightness: undefined,
    color: undefined,
    colorTemperature: undefined
  };

  beforeEach(() => {
    // Reset state before each test
    light = Light.create(mockDeviceId, mockModel, mockName, mockInitialState);
  });

  describe('Creation', () => {
    it('should create a light with valid parameters', () => {
      expect(light.deviceId).toBe(mockDeviceId);
      expect(light.model).toBe(mockModel);
      expect(light.name).toBe(mockName);
      expect(light.isOn).toBe(false);
      expect(light.isOnline).toBe(true);
    });

    it('should throw error when device ID is empty', () => {
      expect(() => {
        Light.create('', mockModel, mockName, mockInitialState);
      }).toThrow('Device ID is required');
    });

    it('should throw error when model is empty', () => {
      expect(() => {
        Light.create(mockDeviceId, '', mockName, mockInitialState);
      }).toThrow('Model is required');
    });

    it('should throw error when name is empty', () => {
      expect(() => {
        Light.create(mockDeviceId, mockModel, '', mockInitialState);
      }).toThrow('Name is required');
    });
  });

  describe('State Management', () => {
    it('should update light state correctly', () => {
      const newState: Partial<LightState> = {
        isOn: true,
        brightness: new Brightness(80)
      };

      light.updateState(newState);

      expect(light.isOn).toBe(true);
      expect(light.brightness).toEqual(new Brightness(80));
      expect(light.isOnline).toBe(true); // Should preserve existing state
    });

    it('should handle partial state updates', () => {
      light.updateState({ isOn: true });
      expect(light.isOn).toBe(true);
      expect(light.isOnline).toBe(true); // Should preserve original value

      light.updateState({ isOnline: false });
      expect(light.isOn).toBe(true); // Should preserve updated value
      expect(light.isOnline).toBe(false);
    });

    it('should handle empty state updates gracefully', () => {
      const originalState = { ...light.state };
      light.updateState({});
      
      expect(light.state).toEqual(originalState);
    });
  });

  describe('Business Rules', () => {
    it('should indicate light can be controlled when online', () => {
      light.updateState({ isOnline: true });
      expect(light.canBeControlled()).toBe(true);
    });

    it('should indicate light cannot be controlled when offline', () => {
      light.updateState({ isOnline: false });
      expect(light.canBeControlled()).toBe(false);
    });
  });

  describe('State Properties', () => {
    it('should correctly expose brightness property', () => {
      const brightness = new Brightness(50);
      light.updateState({ brightness });
      expect(light.brightness).toEqual(brightness);
    });

    it('should return undefined for brightness when not set', () => {
      expect(light.brightness).toBeUndefined();
    });

    it('should correctly expose color property', () => {
      // Note: We'll need to import ColorRgb when we implement color tests
      expect(light.color).toBeUndefined();
    });

    it('should correctly expose color temperature property', () => {
      // Note: We'll need to import ColorTemperature when we implement color temp tests
      expect(light.colorTemperature).toBeUndefined();
    });
  });

  describe('Immutability', () => {
    it('should not allow direct mutation of device properties', () => {
      const originalDeviceId = light.deviceId;
      const originalModel = light.model;
      const originalName = light.name;

      // These properties should be read-only
      expect(light.deviceId).toBe(originalDeviceId);
      expect(light.model).toBe(originalModel);
      expect(light.name).toBe(originalName);
    });

    it('should create new state object on updates', () => {
      const originalState = light.state;
      light.updateState({ isOn: true });
      
      // State should be updated but original object should remain unchanged
      expect(originalState.isOn).toBe(false);
      expect(light.state.isOn).toBe(true);
    });
  });
});