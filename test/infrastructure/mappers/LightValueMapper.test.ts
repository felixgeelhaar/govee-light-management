import { describe, it, expect } from 'vitest';
import {
  Brightness as ApiBrightness,
  ColorRgb as ApiColorRgb,
  ColorTemperature as ApiColorTemperature,
} from '@felixgeelhaar/govee-api-client';
import { Brightness } from '@/backend/domain/value-objects/Brightness';
import { ColorRgb } from '@/backend/domain/value-objects/ColorRgb';
import { ColorTemperature } from '@/backend/domain/value-objects/ColorTemperature';
import { LightValueMapper } from '@/backend/infrastructure/mappers/LightValueMapper';

describe('LightValueMapper', () => {
  describe('Brightness', () => {
    it('maps an API brightness to a domain brightness', () => {
      const api = new ApiBrightness(50);
      const domain = LightValueMapper.toDomainBrightness(api);
      expect(domain).toBeInstanceOf(Brightness);
      expect(domain.level).toBe(50);
    });

    it('maps a domain brightness to an API brightness', () => {
      const domain = new Brightness(75);
      const api = LightValueMapper.toApiBrightness(domain);
      expect(api).toBeInstanceOf(ApiBrightness);
      expect(api.level).toBe(75);
    });

    it('round-trips via API → domain → API preserving the level', () => {
      const original = new ApiBrightness(33);
      const roundTripped = LightValueMapper.toApiBrightness(
        LightValueMapper.toDomainBrightness(original),
      );
      expect(roundTripped.level).toBe(original.level);
    });
  });

  describe('Color', () => {
    it('maps an API color to a domain color', () => {
      const api = new ApiColorRgb(10, 20, 30);
      const domain = LightValueMapper.toDomainColor(api);
      expect(domain).toBeInstanceOf(ColorRgb);
      expect(domain.r).toBe(10);
      expect(domain.g).toBe(20);
      expect(domain.b).toBe(30);
    });

    it('maps a domain color to an API color', () => {
      const domain = new ColorRgb(200, 100, 50);
      const api = LightValueMapper.toApiColor(domain);
      expect(api).toBeInstanceOf(ApiColorRgb);
      expect(api.r).toBe(200);
      expect(api.g).toBe(100);
      expect(api.b).toBe(50);
    });

    it('round-trips via domain → API → domain preserving all channels', () => {
      const original = new ColorRgb(1, 2, 3);
      const roundTripped = LightValueMapper.toDomainColor(
        LightValueMapper.toApiColor(original),
      );
      expect(roundTripped.equals(original)).toBe(true);
    });
  });

  describe('ColorTemperature', () => {
    it('maps an API color temperature to a domain value', () => {
      const api = new ApiColorTemperature(4000);
      const domain = LightValueMapper.toDomainColorTemperature(api);
      expect(domain).toBeInstanceOf(ColorTemperature);
      expect(domain.kelvin).toBe(4000);
    });

    it('maps a domain color temperature to an API value', () => {
      const domain = new ColorTemperature(6500);
      const api = LightValueMapper.toApiColorTemperature(domain);
      expect(api).toBeInstanceOf(ApiColorTemperature);
      expect(api.kelvin).toBe(6500);
    });

    it('round-trips via API → domain → API preserving kelvin', () => {
      const original = new ApiColorTemperature(3200);
      const roundTripped = LightValueMapper.toApiColorTemperature(
        LightValueMapper.toDomainColorTemperature(original),
      );
      expect(roundTripped.kelvin).toBe(original.kelvin);
    });
  });
});
