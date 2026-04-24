export class ColorRgb {
  constructor(
    private readonly _r: number,
    private readonly _g: number,
    private readonly _b: number,
  ) {
    for (const [channel, value] of [
      ["r", _r],
      ["g", _g],
      ["b", _b],
    ] as const) {
      if (!Number.isInteger(value)) {
        throw new Error(`Color channel ${channel} must be an integer`);
      }
      if (value < 0 || value > 255) {
        throw new Error(`Color channel ${channel} must be between 0 and 255`);
      }
    }
  }

  static fromHex(hex: string): ColorRgb {
    const normalized = hex.trim().replace(/^#/, "");
    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
      throw new Error("Hex color must be a 6-digit RGB value");
    }

    return new ColorRgb(
      Number.parseInt(normalized.slice(0, 2), 16),
      Number.parseInt(normalized.slice(2, 4), 16),
      Number.parseInt(normalized.slice(4, 6), 16),
    );
  }

  static fromObject(color: { r: number; g: number; b: number }): ColorRgb {
    return new ColorRgb(color.r, color.g, color.b);
  }

  get r(): number {
    return this._r;
  }

  get g(): number {
    return this._g;
  }

  get b(): number {
    return this._b;
  }

  equals(other: ColorRgb): boolean {
    return this._r === other._r && this._g === other._g && this._b === other._b;
  }

  toJSON(): { r: number; g: number; b: number } {
    return { r: this._r, g: this._g, b: this._b };
  }
}
