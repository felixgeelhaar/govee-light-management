/**
 * MusicModeConfig value object for music-reactive lighting configuration
 *
 * Music mode enables lights to react to sound/music in real-time,
 * changing colors and brightness based on audio input.
 */

/**
 * Available music mode types (from official Govee API)
 * - rhythm: Standard rhythm-based color changes (mode ID: 3)
 * - energic: High-energy, fast-paced reactions (mode ID: 5)
 * - spectrum: Full color spectrum transitions (mode ID: 4)
 * - rolling: Flowing, wave-like color patterns (mode ID: 6)
 */
export type MusicModeType = "rhythm" | "energic" | "spectrum" | "rolling";

export class MusicModeConfig {
  private constructor(
    private readonly _sensitivity: number,
    private readonly _mode: MusicModeType,
    private readonly _autoColor: boolean,
  ) {}

  /**
   * Create a new MusicModeConfig instance
   * @param sensitivity Sound sensitivity level (0-100, higher = more sensitive)
   * @param mode Music mode type
   * @param autoColor Whether colors change automatically with music
   * @throws Error if parameters are invalid
   */
  static create(
    sensitivity: number,
    mode: MusicModeType,
    autoColor: boolean,
  ): MusicModeConfig {
    if (!Number.isInteger(sensitivity)) {
      throw new Error("Sensitivity must be an integer");
    }

    if (sensitivity < 0 || sensitivity > 100) {
      throw new Error("Sensitivity must be between 0 and 100");
    }

    if (!mode?.trim()) {
      throw new Error("Music mode is required");
    }

    return new MusicModeConfig(sensitivity, mode, autoColor);
  }

  /**
   * Predefined config: Rhythm mode (standard sensitivity)
   */
  static rhythm(): MusicModeConfig {
    return MusicModeConfig.create(50, "rhythm", true);
  }

  /**
   * Predefined config: Energic mode (high sensitivity)
   */
  static energic(): MusicModeConfig {
    return MusicModeConfig.create(75, "energic", true);
  }

  /**
   * Predefined config: Spectrum mode (medium-high sensitivity)
   */
  static spectrum(): MusicModeConfig {
    return MusicModeConfig.create(60, "spectrum", true);
  }

  /**
   * Predefined config: Rolling mode (standard sensitivity)
   */
  static rolling(): MusicModeConfig {
    return MusicModeConfig.create(50, "rolling", true);
  }

  get sensitivity(): number {
    return this._sensitivity;
  }

  get mode(): MusicModeType {
    return this._mode;
  }

  get autoColor(): boolean {
    return this._autoColor;
  }

  /**
   * Check equality with another MusicModeConfig
   */
  equals(other: MusicModeConfig): boolean {
    return (
      this._sensitivity === other._sensitivity &&
      this._mode === other._mode &&
      this._autoColor === other._autoColor
    );
  }

  /**
   * Serialize to plain object for storage/transmission
   */
  toJSON(): { sensitivity: number; mode: MusicModeType; autoColor: boolean } {
    return {
      sensitivity: this._sensitivity,
      mode: this._mode,
      autoColor: this._autoColor,
    };
  }

  /**
   * Deserialize from plain object
   * @param data Plain object with music mode config data
   * @throws Error if data is invalid
   */
  static fromJSON(data: {
    sensitivity: number;
    mode: MusicModeType;
    autoColor: boolean;
  }): MusicModeConfig {
    if (data.autoColor === undefined || data.autoColor === null) {
      throw new Error("autoColor is required");
    }

    return MusicModeConfig.create(data.sensitivity, data.mode, data.autoColor);
  }

  /**
   * Human-readable string representation
   */
  toString(): string {
    return `MusicModeConfig(mode: ${this._mode}, sensitivity: ${this._sensitivity}%, autoColor: ${this._autoColor})`;
  }
}
