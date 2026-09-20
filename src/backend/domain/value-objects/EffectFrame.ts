import { hsvToRgb } from "./color-conversion";

const SEGMENT_COUNT = 15;
const HEX_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

export interface EffectFrameJSON {
  timingMs: number;
  segmentColors: string[];
}

/**
 * Immutable value object representing a single animation frame.
 * Contains per-segment colors (all 15 segments for Govee RGB IC strips)
 * and a timing offset from the start of the animation.
 */
export class EffectFrame {
  private constructor(
    public readonly timingMs: number,
    public readonly segmentColors: readonly string[],
  ) {}

  static create(props: {
    timingMs: number;
    segmentColors: string[];
  }): EffectFrame {
    if (props.timingMs < 0) {
      throw new Error("Timing must be non-negative");
    }
    if (props.segmentColors.length !== SEGMENT_COUNT) {
      throw new Error(`Must provide colors for all ${SEGMENT_COUNT} segments`);
    }
    props.segmentColors.forEach((hex) => {
      if (!HEX_REGEX.test(hex)) {
        throw new Error(`Invalid hex color: ${hex}`);
      }
    });
    return new EffectFrame(
      props.timingMs,
      Object.freeze([...props.segmentColors.map((c) => c.toUpperCase())]),
    );
  }

  /**
   * Create a frame where all segments display the same color.
   */
  static uniform(timingMs: number, hex: string): EffectFrame {
    const colors = Array(SEGMENT_COUNT).fill(hex);
    return EffectFrame.create({ timingMs, segmentColors: colors });
  }

  /**
   * Create a gradient frame from startHex to endHex across segments.
   */
  static gradient(
    timingMs: number,
    startHex: string,
    endHex: string,
  ): EffectFrame {
    const start = EffectFrame.hexToRgb(startHex);
    const end = EffectFrame.hexToRgb(endHex);
    const colors = Array.from({ length: SEGMENT_COUNT }, (_, i) => {
      const t = i / (SEGMENT_COUNT - 1);
      const r = Math.round(start.r + (end.r - start.r) * t);
      const g = Math.round(start.g + (end.g - start.g) * t);
      const b = Math.round(start.b + (end.b - start.b) * t);
      return EffectFrame.rgbToHex(r, g, b);
    });
    return EffectFrame.create({ timingMs, segmentColors: colors });
  }

  /**
   * Create a rainbow frame with HSV hue distributed across segments.
   */
  static rainbow(timingMs: number, hueOffset = 0): EffectFrame {
    const colors = Array.from({ length: SEGMENT_COUNT }, (_, i) => {
      const hue = (hueOffset + (i / SEGMENT_COUNT) * 360) % 360;
      return EffectFrame.hsvToHex(hue, 100, 100);
    });
    return EffectFrame.create({ timingMs, segmentColors: colors });
  }

  toJSON(): EffectFrameJSON {
    return {
      timingMs: this.timingMs,
      segmentColors: [...this.segmentColors],
    };
  }

  static fromJSON(json: EffectFrameJSON): EffectFrame {
    return EffectFrame.create({
      timingMs: json.timingMs,
      segmentColors: [...json.segmentColors],
    });
  }

  // ─── Color Helpers ───────────────────────────────────────

  private static hexToRgb(hex: string): { r: number; g: number; b: number } {
    const clean = hex.replace("#", "");
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  }

  private static rgbToHex(r: number, g: number, b: number): string {
    return (
      "#" +
      [r, g, b]
        .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()
    );
  }

  private static hsvToHex(h: number, s: number, v: number): string {
    const { r, g, b } = hsvToRgb(h, s, v);
    return EffectFrame.rgbToHex(r, g, b);
  }
}
