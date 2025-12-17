#!/usr/bin/env node

/**
 * Generate Icon Assets for Stream Deck Plugin
 * Creates all missing icon and background images for new actions
 */

import { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_DIR = join(__dirname, '..', 'com.felixgeelhaar.govee-light-management.sdPlugin', 'imgs', 'actions');

// Icon sizes
const ICON_SIZE = 20;
const ICON_2X_SIZE = 40;
const KEY_SIZE = 72;
const KEY_2X_SIZE = 144;
const BACKGROUND_WIDTH = 200;
const BACKGROUND_HEIGHT = 100;
const BACKGROUND_2X_WIDTH = 400;
const BACKGROUND_2X_HEIGHT = 200;

/**
 * Save canvas to PNG file
 */
function saveCanvas(canvas, filepath) {
  mkdirSync(dirname(filepath), { recursive: true });
  const buffer = canvas.toBuffer('image/png');
  writeFileSync(filepath, buffer);
  console.log(`✓ Created: ${filepath}`);
}

/**
 * Draw rounded rectangle
 */
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Generate Brightness Dial Icons
 */
function generateBrightnessDialIcons() {
  const dir = join(BASE_DIR, 'brightness-dial');

  // Icon (sun symbol)
  [ICON_SIZE, ICON_2X_SIZE].forEach((size, idx) => {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Dark background
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, size, size);

    // Sun rays and circle
    const center = size / 2;
    const sunRadius = size * 0.25;
    const rayLength = size * 0.15;

    // Draw rays
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = size * 0.08;
    ctx.lineCap = 'round';

    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      const x1 = center + Math.cos(angle) * (sunRadius + size * 0.05);
      const y1 = center + Math.sin(angle) * (sunRadius + size * 0.05);
      const x2 = center + Math.cos(angle) * (sunRadius + rayLength + size * 0.05);
      const y2 = center + Math.sin(angle) * (sunRadius + rayLength + size * 0.05);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Draw sun circle
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(center, center, sunRadius, 0, Math.PI * 2);
    ctx.fill();

    const filename = idx === 0 ? 'icon.png' : 'icon@2x.png';
    saveCanvas(canvas, join(dir, filename));
  });

  // Background (gradient from dark to bright)
  [
    [BACKGROUND_WIDTH, BACKGROUND_HEIGHT],
    [BACKGROUND_2X_WIDTH, BACKGROUND_2X_HEIGHT]
  ].forEach(([width, height], idx) => {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Horizontal gradient from dark to bright
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, '#1a1a1a');
    gradient.addColorStop(0.5, '#4a4a4a');
    gradient.addColorStop(1, '#FFD700');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const filename = idx === 0 ? 'background.png' : 'background@2x.png';
    saveCanvas(canvas, join(dir, filename));
  });
}

/**
 * Generate Color Temperature Dial Icons
 */
function generateColorTempDialIcons() {
  const dir = join(BASE_DIR, 'colortemp-dial');

  // Icon (two-tone circle)
  [ICON_SIZE, ICON_2X_SIZE].forEach((size, idx) => {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Dark background
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, size, size);

    const center = size / 2;
    const radius = size * 0.35;

    // Warm half (orange)
    ctx.fillStyle = '#FF8C42';
    ctx.beginPath();
    ctx.arc(center, center, radius, Math.PI * 0.5, Math.PI * 1.5);
    ctx.lineTo(center, center);
    ctx.fill();

    // Cool half (blue)
    ctx.fillStyle = '#42A5FF';
    ctx.beginPath();
    ctx.arc(center, center, radius, Math.PI * 1.5, Math.PI * 0.5);
    ctx.lineTo(center, center);
    ctx.fill();

    const filename = idx === 0 ? 'icon.png' : 'icon@2x.png';
    saveCanvas(canvas, join(dir, filename));
  });

  // Background (warm to cool gradient)
  [
    [BACKGROUND_WIDTH, BACKGROUND_HEIGHT],
    [BACKGROUND_2X_WIDTH, BACKGROUND_2X_HEIGHT]
  ].forEach(([width, height], idx) => {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Gradient from warm orange to cool blue
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, '#FF8C42');
    gradient.addColorStop(0.5, '#FFFFFF');
    gradient.addColorStop(1, '#42A5FF');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const filename = idx === 0 ? 'background.png' : 'background@2x.png';
    saveCanvas(canvas, join(dir, filename));
  });
}

/**
 * Generate Color Hue Dial Icons
 */
function generateColorHueDialIcons() {
  const dir = join(BASE_DIR, 'colorhue-dial');

  // Icon (color wheel segment)
  [ICON_SIZE, ICON_2X_SIZE].forEach((size, idx) => {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Dark background
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, size, size);

    const center = size / 2;
    const radius = size * 0.35;

    // Draw color wheel segments
    const colors = ['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF'];
    const segmentAngle = (Math.PI * 2) / colors.length;

    colors.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(center, center, radius, i * segmentAngle, (i + 1) * segmentAngle);
      ctx.lineTo(center, center);
      ctx.fill();
    });

    const filename = idx === 0 ? 'icon.png' : 'icon@2x.png';
    saveCanvas(canvas, join(dir, filename));
  });

  // Background (rainbow gradient)
  [
    [BACKGROUND_WIDTH, BACKGROUND_HEIGHT],
    [BACKGROUND_2X_WIDTH, BACKGROUND_2X_HEIGHT]
  ].forEach(([width, height], idx) => {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Rainbow gradient
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, '#FF0000');
    gradient.addColorStop(0.17, '#FF8C00');
    gradient.addColorStop(0.33, '#FFFF00');
    gradient.addColorStop(0.5, '#00FF00');
    gradient.addColorStop(0.67, '#0000FF');
    gradient.addColorStop(0.83, '#8B00FF');
    gradient.addColorStop(1, '#FF0000');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const filename = idx === 0 ? 'background.png' : 'background@2x.png';
    saveCanvas(canvas, join(dir, filename));
  });
}

/**
 * Generate Scene Control Icons
 */
function generateSceneControlIcons() {
  const dir = join(BASE_DIR, 'scene');

  // Icon (small landscape)
  [ICON_SIZE, ICON_2X_SIZE].forEach((size, idx) => {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Dark background
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, size, size);

    // Sun
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(size * 0.7, size * 0.3, size * 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Mountains
    ctx.fillStyle = '#4A90E2';
    ctx.beginPath();
    ctx.moveTo(0, size * 0.7);
    ctx.lineTo(size * 0.5, size * 0.4);
    ctx.lineTo(size, size * 0.7);
    ctx.fill();

    const filename = idx === 0 ? 'icon.png' : 'icon@2x.png';
    saveCanvas(canvas, join(dir, filename));
  });

  // Key (larger landscape)
  [KEY_SIZE, KEY_2X_SIZE].forEach((size, idx) => {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Background gradient (sky)
    const gradient = ctx.createLinearGradient(0, 0, 0, size);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(1, '#FFB6C1');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    // Sun
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(size * 0.7, size * 0.25, size * 0.12, 0, Math.PI * 2);
    ctx.fill();

    // Mountains
    ctx.fillStyle = '#4A90E2';
    ctx.beginPath();
    ctx.moveTo(0, size * 0.7);
    ctx.lineTo(size * 0.5, size * 0.35);
    ctx.lineTo(size, size * 0.7);
    ctx.closePath();
    ctx.fill();

    // Ground
    ctx.fillStyle = '#228B22';
    ctx.fillRect(0, size * 0.7, size, size * 0.3);

    const filename = idx === 0 ? 'key.png' : 'key@2x.png';
    saveCanvas(canvas, join(dir, filename));
  });
}

/**
 * Generate Music Mode Icons
 */
function generateMusicModeIcons() {
  const dir = join(BASE_DIR, 'music');

  // Icon (waveform)
  [ICON_SIZE, ICON_2X_SIZE].forEach((size, idx) => {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Dark background
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, size, size);

    // Waveform bars
    ctx.fillStyle = '#00FF88';
    const bars = 5;
    const barWidth = size / (bars * 2);
    const heights = [0.3, 0.7, 0.5, 0.8, 0.4];

    for (let i = 0; i < bars; i++) {
      const x = i * barWidth * 2 + barWidth * 0.5;
      const barHeight = size * heights[i];
      const y = (size - barHeight) / 2;

      roundRect(ctx, x, y, barWidth, barHeight, barWidth * 0.2);
      ctx.fill();
    }

    const filename = idx === 0 ? 'icon.png' : 'icon@2x.png';
    saveCanvas(canvas, join(dir, filename));
  });

  // Key (larger waveform with glow)
  [KEY_SIZE, KEY_2X_SIZE].forEach((size, idx) => {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Dark background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, size, size);

    // Waveform bars with gradient
    const bars = 9;
    const barWidth = size / (bars * 1.5);
    const spacing = barWidth * 0.5;

    for (let i = 0; i < bars; i++) {
      const height = (Math.sin(i * 0.8) + 1) * 0.3 + 0.2;
      const barHeight = size * height;
      const x = i * (barWidth + spacing) + size * 0.1;
      const y = (size - barHeight) / 2;

      // Gradient for each bar
      const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
      gradient.addColorStop(0, '#00FF88');
      gradient.addColorStop(1, '#00AA55');

      ctx.fillStyle = gradient;
      roundRect(ctx, x, y, barWidth, barHeight, barWidth * 0.15);
      ctx.fill();
    }

    const filename = idx === 0 ? 'key.png' : 'key@2x.png';
    saveCanvas(canvas, join(dir, filename));
  });
}

/**
 * Generate Segment Color Dial Icons
 */
function generateSegmentColorDialIcons() {
  const dir = join(BASE_DIR, 'segment-color-dial');

  // Icon (segmented LED strip)
  [ICON_SIZE, ICON_2X_SIZE].forEach((size, idx) => {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Dark background
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, size, size);

    // LED segments
    const segments = 5;
    const segmentWidth = size * 0.8 / segments;
    const segmentHeight = size * 0.3;
    const y = (size - segmentHeight) / 2;
    const startX = size * 0.1;

    const colors = ['#FF0000', '#FFAA00', '#00FF00', '#00AAFF', '#AA00FF'];

    for (let i = 0; i < segments; i++) {
      const x = startX + i * segmentWidth;
      ctx.fillStyle = colors[i];
      roundRect(ctx, x, y, segmentWidth * 0.9, segmentHeight, segmentWidth * 0.2);
      ctx.fill();
    }

    const filename = idx === 0 ? 'icon.png' : 'icon@2x.png';
    saveCanvas(canvas, join(dir, filename));
  });

  // Background (segmented rainbow)
  [
    [BACKGROUND_WIDTH, BACKGROUND_HEIGHT],
    [BACKGROUND_2X_WIDTH, BACKGROUND_2X_HEIGHT]
  ].forEach(([width, height], idx) => {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Segmented gradient
    const segments = 15;
    const segmentWidth = width / segments;

    for (let i = 0; i < segments; i++) {
      const hue = (i / segments) * 360;
      ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
      ctx.fillRect(i * segmentWidth, 0, segmentWidth, height);
    }

    const filename = idx === 0 ? 'background.png' : 'background@2x.png';
    saveCanvas(canvas, join(dir, filename));
  });
}

/**
 * Main execution
 */
console.log('🎨 Generating Stream Deck icon assets...\n');

try {
  generateBrightnessDialIcons();
  console.log('');

  generateColorTempDialIcons();
  console.log('');

  generateColorHueDialIcons();
  console.log('');

  generateSceneControlIcons();
  console.log('');

  generateMusicModeIcons();
  console.log('');

  generateSegmentColorDialIcons();
  console.log('');

  console.log('✅ All icon assets generated successfully!');
  console.log('\nGenerated assets:');
  console.log('  • Brightness Dial: icon.png, icon@2x.png, background.png, background@2x.png');
  console.log('  • Color Temperature Dial: icon.png, icon@2x.png, background.png, background@2x.png');
  console.log('  • Color Hue Dial: icon.png, icon@2x.png, background.png, background@2x.png');
  console.log('  • Scene Control: icon.png, icon@2x.png, key.png, key@2x.png');
  console.log('  • Music Mode: icon.png, icon@2x.png, key.png, key@2x.png');
  console.log('  • Segment Color Dial: icon.png, icon@2x.png, background.png, background@2x.png');

} catch (error) {
  console.error('❌ Error generating assets:', error);
  process.exit(1);
}
