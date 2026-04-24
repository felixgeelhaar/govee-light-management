export class MusicModeOption {
  private constructor(
    private readonly _modeId: number,
    private readonly _sensitivity: number,
  ) {}

  static create(modeId: number, sensitivity: number): MusicModeOption {
    if (!Number.isInteger(modeId)) {
      throw new Error("Music mode ID must be an integer");
    }

    if (!Number.isInteger(sensitivity)) {
      throw new Error("Sensitivity must be an integer");
    }

    if (sensitivity < 0 || sensitivity > 100) {
      throw new Error("Sensitivity must be between 0 and 100");
    }

    return new MusicModeOption(modeId, sensitivity);
  }

  get modeId(): number {
    return this._modeId;
  }

  get sensitivity(): number {
    return this._sensitivity;
  }

  equals(other: MusicModeOption): boolean {
    return (
      this._modeId === other._modeId && this._sensitivity === other._sensitivity
    );
  }

  toJSON(): { modeId: number; sensitivity: number } {
    return {
      modeId: this._modeId,
      sensitivity: this._sensitivity,
    };
  }
}
