import { ColorRgb, ColorTemperature, Brightness } from '@felixgeelhaar/govee-api-client';
import { LightState } from '../value-objects/LightState';

export class Light {
  private constructor(
    private readonly _deviceId: string,
    private readonly _model: string,
    private readonly _name: string,
    private _state: LightState,
  ) {}

  static create(
    deviceId: string,
    model: string,
    name: string,
    initialState: LightState,
  ): Light {
    if (!deviceId?.trim()) {
      throw new Error('Device ID is required');
    }
    if (!model?.trim()) {
      throw new Error('Model is required');
    }
    if (!name?.trim()) {
      throw new Error('Name is required');
    }

    return new Light(deviceId, model, name, initialState);
  }

  get deviceId(): string {
    return this._deviceId;
  }

  get model(): string {
    return this._model;
  }

  get name(): string {
    return this._name;
  }

  get state(): LightState {
    return { ...this._state };
  }

  get isOnline(): boolean {
    return this._state.isOnline;
  }

  get isOn(): boolean {
    return this._state.isOn;
  }

  get brightness(): Brightness | undefined {
    return this._state.brightness;
  }

  get color(): ColorRgb | undefined {
    return this._state.color;
  }

  get colorTemperature(): ColorTemperature | undefined {
    return this._state.colorTemperature;
  }

  updateState(newState: Partial<LightState>): void {
    this._state = {
      ...this._state,
      ...newState,
    };
  }

  canBeControlled(): boolean {
    return this._state.isOnline;
  }

  equals(other: Light): boolean {
    return this._deviceId === other._deviceId && this._model === other._model;
  }

  toString(): string {
    return `Light(${this._deviceId}, ${this._name}, online=${this._state.isOnline}, on=${this._state.isOn})`;
  }
}