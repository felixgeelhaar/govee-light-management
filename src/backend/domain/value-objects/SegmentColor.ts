/**
 * SegmentColor value object for RGB IC lights with per-segment color control
 *
 * RGB IC (Integrated Circuit) lights have individually addressable LED segments
 * where each segment can display a different color, enabling complex patterns
 * and effects like rainbow gradients, multi-color scenes, etc.
 */

import { ColorRgb } from "@felixgeelhaar/govee-api-client";

export class SegmentColor {
  private constructor(
    private readonly _segmentIndex: number,
    private readonly _color: ColorRgb,
  ) {}

  /**
   * Create a new SegmentColor instance
   * @param segmentIndex Zero-based LED segment position (must be non-negative integer)
   * @param color RGB color for this segment
   * @throws Error if segment index is invalid or color is not provided
   */
  static create(segmentIndex: number, color: ColorRgb): SegmentColor {
    if (color === null || color === undefined) {
      throw new Error("Color is required");
    }

    if (segmentIndex < 0) {
      throw new Error("Segment index must be non-negative");
    }

    if (!Number.isInteger(segmentIndex)) {
      throw new Error("Segment index must be an integer");
    }

    return new SegmentColor(segmentIndex, color);
  }

  get segmentIndex(): number {
    return this._segmentIndex;
  }

  get color(): ColorRgb {
    return this._color;
  }

  /**
   * Check equality with another SegmentColor based on segment index and color
   */
  equals(other: SegmentColor): boolean {
    if (this._segmentIndex !== other._segmentIndex) {
      return false;
    }

    // Compare RGB components using getters
    return (
      this._color.r === other._color.r &&
      this._color.g === other._color.g &&
      this._color.b === other._color.b
    );
  }

  /**
   * Serialize to plain object for storage/transmission
   */
  toJSON(): {
    segmentIndex: number;
    color: { r: number; g: number; b: number };
  } {
    return {
      segmentIndex: this._segmentIndex,
      color: {
        r: this._color.r,
        g: this._color.g,
        b: this._color.b,
      },
    };
  }

  /**
   * Deserialize from plain object
   * @param data Plain object with segment color data
   * @throws Error if data is invalid
   */
  static fromJSON(data: {
    segmentIndex: number;
    color: { r: number; g: number; b: number };
  }): SegmentColor {
    if (!data.color) {
      throw new Error("Color is required");
    }

    const color = new ColorRgb(data.color.r, data.color.g, data.color.b);
    return SegmentColor.create(data.segmentIndex, color);
  }

  /**
   * Human-readable string representation
   */
  toString(): string {
    return `SegmentColor(index: ${this._segmentIndex}, color: RGB(${this._color.r}, ${this._color.g}, ${this._color.b}))`;
  }
}
