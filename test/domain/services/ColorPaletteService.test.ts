import { describe, it, expect, beforeEach } from 'vitest';
import { ColorPaletteService } from '../../../src/backend/domain/services/ColorPaletteService';

describe('ColorPaletteService', () => {
  let service: ColorPaletteService;

  beforeEach(() => {
    service = new ColorPaletteService();
  });

  describe('Preset Palettes', () => {
    it('should return 4 preset palettes', () => {
      const palettes = service.getPresetPalettes();
      expect(palettes).toHaveLength(4);
    });

    it('should have Warm palette', () => {
      const palettes = service.getPresetPalettes();
      const warmPalette = palettes.find(p => p.name === 'Warm');
      expect(warmPalette).toBeDefined();
      expect(warmPalette?.colors.length).toBeGreaterThan(0);
    });

    it('should have Cool palette', () => {
      const palettes = service.getPresetPalettes();
      const coolPalette = palettes.find(p => p.name === 'Cool');
      expect(coolPalette).toBeDefined();
      expect(coolPalette?.colors.length).toBeGreaterThan(0);
    });

    it('should have Pastel palette', () => {
      const palettes = service.getPresetPalettes();
      const pastelPalette = palettes.find(p => p.name === 'Pastel');
      expect(pastelPalette).toBeDefined();
      expect(pastelPalette?.colors.length).toBeGreaterThan(0);
    });

    it('should have Vivid palette', () => {
      const palettes = service.getPresetPalettes();
      const vividPalette = palettes.find(p => p.name === 'Vivid');
      expect(vividPalette).toBeDefined();
      expect(vividPalette?.colors.length).toBeGreaterThan(0);
    });
  });

  describe('Warm Palette Colors', () => {
    it('should contain amber color', () => {
      const palettes = service.getPresetPalettes();
      const warmPalette = palettes.find(p => p.name === 'Warm')!;
      const colors = warmPalette.colors.map(c => c.name);
      expect(colors).toContain('Amber');
    });

    it('should contain orange color', () => {
      const palettes = service.getPresetPalettes();
      const warmPalette = palettes.find(p => p.name === 'Warm')!;
      const colors = warmPalette.colors.map(c => c.name);
      expect(colors).toContain('Orange');
    });

    it('should contain warm white color', () => {
      const palettes = service.getPresetPalettes();
      const warmPalette = palettes.find(p => p.name === 'Warm')!;
      const colors = warmPalette.colors.map(c => c.name);
      expect(colors).toContain('Warm White');
    });
  });

  describe('Cool Palette Colors', () => {
    it('should contain cool white color', () => {
      const palettes = service.getPresetPalettes();
      const coolPalette = palettes.find(p => p.name === 'Cool')!;
      const colors = coolPalette.colors.map(c => c.name);
      expect(colors).toContain('Cool White');
    });

    it('should contain cyan color', () => {
      const palettes = service.getPresetPalettes();
      const coolPalette = palettes.find(p => p.name === 'Cool')!;
      const colors = coolPalette.colors.map(c => c.name);
      expect(colors).toContain('Cyan');
    });

    it('should contain blue color', () => {
      const palettes = service.getPresetPalettes();
      const coolPalette = palettes.find(p => p.name === 'Cool')!;
      const colors = coolPalette.colors.map(c => c.name);
      expect(colors).toContain('Blue');
    });
  });

  describe('Recent Colors', () => {
    it('should track recent colors', () => {
      service.addRecentColor({ hex: '#FF0000', name: 'Red' });
      const recent = service.getRecentColors();
      expect(recent).toHaveLength(1);
      expect(recent[0].hex).toBe('#FF0000');
    });

    it('should keep most recent first', () => {
      service.addRecentColor({ hex: '#FF0000', name: 'Red' });
      service.addRecentColor({ hex: '#00FF00', name: 'Green' });
      const recent = service.getRecentColors();
      expect(recent[0].hex).toBe('#00FF00');
      expect(recent[1].hex).toBe('#FF0000');
    });

    it('should limit recent colors to 10', () => {
      for (let i = 0; i < 15; i++) {
        service.addRecentColor({ hex: `#${i.toString().padStart(6, '0')}`, name: `Color ${i}` });
      }
      const recent = service.getRecentColors();
      expect(recent).toHaveLength(10);
    });

    it('should not duplicate recent colors', () => {
      service.addRecentColor({ hex: '#FF0000', name: 'Red' });
      service.addRecentColor({ hex: '#00FF00', name: 'Green' });
      service.addRecentColor({ hex: '#FF0000', name: 'Red' });
      const recent = service.getRecentColors();
      expect(recent).toHaveLength(2);
      expect(recent[0].hex).toBe('#FF0000');
    });

    it('should clear recent colors', () => {
      service.addRecentColor({ hex: '#FF0000', name: 'Red' });
      service.clearRecentColors();
      const recent = service.getRecentColors();
      expect(recent).toHaveLength(0);
    });
  });

  describe('Persistence', () => {
    it('should load recent colors from storage', () => {
      service.loadRecentColors([
        { hex: '#FF0000', name: 'Red' },
        { hex: '#00FF00', name: 'Green' },
      ]);
      const recent = service.getRecentColors();
      expect(recent).toHaveLength(2);
      expect(recent[0].hex).toBe('#FF0000');
      expect(recent[1].hex).toBe('#00FF00');
    });

    it('should export recent colors for persistence', () => {
      service.addRecentColor({ hex: '#FF0000', name: 'Red' });
      service.addRecentColor({ hex: '#00FF00', name: 'Green' });
      const exported = service.exportRecentColors();
      expect(exported).toHaveLength(2);
      expect(exported[0]).toEqual({ hex: '#00FF00', name: 'Green' });
      expect(exported[1]).toEqual({ hex: '#FF0000', name: 'Red' });
    });

    it('should filter invalid colors when loading', () => {
      service.loadRecentColors([
        { hex: '#FF0000', name: 'Red' },
        { hex: 'invalid', name: 'Bad' },
        { hex: '#00FF00', name: 'Green' },
      ]);
      expect(service.getRecentColors()).toHaveLength(2);
    });

    it('should limit loaded colors to max', () => {
      const manyColors = Array.from({ length: 15 }, (_, i) => ({
        hex: `#${i.toString(16).padStart(6, '0')}`,
        name: `Color ${i}`,
      }));
      service.loadRecentColors(manyColors);
      expect(service.getRecentColors()).toHaveLength(10);
    });
  });

  describe('Color Validation', () => {
    it('should validate hex color format', () => {
      const validColors = [
        { hex: '#FF0000', valid: true },
        { hex: '#00FF00', valid: true },
        { hex: '#0000FF', valid: true },
        { hex: '#FFF', valid: true }, // 3-digit hex
        { hex: 'FF0000', valid: true }, // also valid without #
        { hex: '#GGGGGG', valid: false }, // invalid hex
        { hex: 'ZZZ', valid: false }, // invalid
      ];

      validColors.forEach(({ hex, valid }) => {
        expect(service.isValidHexColor(hex)).toBe(valid);
      });
    });
  });
});
