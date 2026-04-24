export class ColorTemperature {
  constructor(private readonly _kelvin: number) {
    if (!Number.isInteger(_kelvin)) {
      throw new Error("Color temperature must be an integer");
    }
    if (_kelvin <= 0) {
      throw new Error("Color temperature must be greater than 0");
    }
  }

  get kelvin(): number {
    return this._kelvin;
  }

  equals(other: ColorTemperature): boolean {
    return this._kelvin === other._kelvin;
  }

  toJSON(): number {
    return this._kelvin;
  }
}
