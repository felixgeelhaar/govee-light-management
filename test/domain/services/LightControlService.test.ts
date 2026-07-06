/**
 * Test-Driven Development tests for LightControlService
 * 
 * Tests service orchestration and light control operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LightControlService } from '@/backend/domain/services/LightControlService';
import { Light } from '@/backend/domain/entities/Light';
import { LightGroup } from '@/backend/domain/entities/LightGroup';
import { LightState } from '@/backend/domain/value-objects/LightState';
import { Brightness } from '@/backend/domain/value-objects/Brightness';
import { ColorRgb } from '@/backend/domain/value-objects/ColorRgb';
import { ColorTemperature } from '@/backend/domain/value-objects/ColorTemperature';

// Mock the light repository to match ILightRepository interface
const mockLightRepository = {
  getAllLights: vi.fn(),
  findLight: vi.fn(),
  findLightsByName: vi.fn(),
  setPower: vi.fn(),
  setBrightness: vi.fn(),
  setColor: vi.fn(),
  setColorTemperature: vi.fn(),
  turnOnWithBrightness: vi.fn(),
  turnOnWithColor: vi.fn(),
  turnOnWithColorTemperature: vi.fn(),
  getLightState: vi.fn(),
};

describe('LightControlService', () => {
  let service: LightControlService;
  let mockLight: Light;
  let mockGroup: LightGroup;

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
    vi.clearAllMocks();
    service = new LightControlService(mockLightRepository as any);
    mockLight = createMockLight('device1', 'Test Light', false, true);
    
    const light1 = createMockLight('device1', 'Light 1', false, true);
    const light2 = createMockLight('device2', 'Light 2', false, true);
    mockGroup = LightGroup.create('group1', 'Test Group', [light1, light2]);
  });

  describe('Individual Light Control', () => {
    it('should control light on/off state', async () => {
      mockLightRepository.setPower.mockResolvedValue(undefined);

      await service.controlLight(mockLight, 'on');

      expect(mockLightRepository.setPower).toHaveBeenCalledWith(mockLight, true);
    });

    it('should control light brightness', async () => {
      const brightness = new Brightness(75);
      mockLightRepository.setBrightness.mockResolvedValue(undefined);

      await service.controlLight(mockLight, 'brightness', brightness);

      expect(mockLightRepository.setBrightness).toHaveBeenCalledWith(mockLight, brightness);
    });

    it('should control light color', async () => {
      const color = ColorRgb.fromHex('#FF0000');
      mockLightRepository.setColor.mockResolvedValue(undefined);

      await service.controlLight(mockLight, 'color', color);

      expect(mockLightRepository.setColor).toHaveBeenCalledWith(mockLight, color);
    });

    it('should control light color temperature', async () => {
      const colorTemp = new ColorTemperature(3000);
      mockLightRepository.setColorTemperature.mockResolvedValue(undefined);

      await service.controlLight(mockLight, 'colorTemperature', colorTemp);

      expect(mockLightRepository.setColorTemperature).toHaveBeenCalledWith(mockLight, colorTemp);
    });

    it('should attempt control on lights flagged offline (unreliable online flag, #311)', async () => {
      // The Govee cloud `online` flag is unreliable and often reports reachable
      // devices as offline. Control must be attempted, not pre-blocked.
      const offlineLight = createMockLight('offline', 'Offline Light', false, false);
      mockLightRepository.setPower.mockResolvedValue(undefined);

      await service.controlLight(offlineLight, 'on');

      expect(mockLightRepository.setPower).toHaveBeenCalledWith(offlineLight, true);
    });

    it('should surface the real transport error when a flagged-offline device genuinely fails', async () => {
      const offlineLight = createMockLight('offline', 'Offline Light', false, false);
      mockLightRepository.setPower.mockRejectedValue(new Error('device unreachable'));

      await expect(
        service.controlLight(offlineLight, 'on')
      ).rejects.toThrow('device unreachable');
    });

    it('should turn on light with settings', async () => {
      const settings = {
        brightness: new Brightness(80),
        color: ColorRgb.fromHex('#00FF00')
      };
      mockLightRepository.turnOnWithColor.mockResolvedValue(undefined);

      await service.turnOnLightWithSettings(mockLight, settings);

      expect(mockLightRepository.turnOnWithColor).toHaveBeenCalledWith(mockLight, settings.color, settings.brightness);
    });
  });

  describe('Group Control', () => {
    it('should control all lights in group', async () => {
      mockLightRepository.setPower.mockResolvedValue(undefined);

      await service.controlGroup(mockGroup, 'on');

      // Should control both lights in the group
      expect(mockLightRepository.setPower).toHaveBeenCalledTimes(2);
    });

    it('should attempt all members regardless of the offline flag (#311)', async () => {
      // A member flagged offline is no longer pre-filtered — the flag is
      // unreliable, so every member gets the command.
      const lights = mockGroup.lights;
      lights[1].updateState({ isOnline: false });
      mockLightRepository.setPower.mockResolvedValue(undefined);

      await service.controlGroup(mockGroup, 'on');

      expect(mockLightRepository.setPower).toHaveBeenCalledTimes(2);
    });

    it('should turn on group with settings', async () => {
      const settings = {
        brightness: new Brightness(60),
        colorTemperature: new ColorTemperature(4000)
      };
      mockLightRepository.turnOnWithColorTemperature.mockResolvedValue(undefined);

      await service.turnOnGroupWithSettings(mockGroup, settings);

      // Should turn on both lights with color temperature and brightness
      expect(mockLightRepository.turnOnWithColorTemperature).toHaveBeenCalledTimes(2);
    });

    it('should handle empty groups gracefully', async () => {
      const emptyGroup = LightGroup.create('empty', 'Empty Group', []);

      await expect(
        service.controlGroup(emptyGroup, 'on')
      ).rejects.toThrow('Group Empty Group has no lights');
    });
  });

  describe('Error Handling', () => {
    it('should handle repository errors gracefully', async () => {
      mockLightRepository.setPower.mockRejectedValue(new Error('API Error'));

      await expect(
        service.controlLight(mockLight, 'on')
      ).rejects.toThrow('API Error');
    });

    it('should continue with other lights if one fails in group', async () => {
      // First call fails, second succeeds
      mockLightRepository.setPower
        .mockRejectedValueOnce(new Error('First light failed'))
        .mockResolvedValueOnce(undefined);

      // Should propagate the error from Promise.all
      await expect(
        service.controlGroup(mockGroup, 'on')
      ).rejects.toThrow('First light failed');
    });
  });
});
