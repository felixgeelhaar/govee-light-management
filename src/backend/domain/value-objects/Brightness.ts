export class Brightness {
  constructor(private readonly _level: number) {
    if (!Number.isInteger(_level)) {
      throw new Error("Brightness level must be an integer");
    }
    if (_level < 0 || _level > 100) {
      throw new Error("Brightness level must be between 0 and 100");
    }
  }

  get level(): number {
    return this._level;
  }

  equals(other: Brightness): boolean {
    return this._level === other._level;
  }

  toJSON(): number {
    return this._level;
  }
}
