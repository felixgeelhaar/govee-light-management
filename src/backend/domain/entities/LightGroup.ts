import { Light } from "./Light";

export class LightGroup {
  private constructor(
    private readonly _id: string,
    private readonly _name: string,
    private _lights: Set<Light>,
  ) {}

  static create(id: string, name: string, lights: Light[] = []): LightGroup {
    if (!id?.trim()) {
      throw new Error("Group ID is required");
    }
    if (!name?.trim()) {
      throw new Error("Group name is required");
    }

    // Validate that all lights are unique
    const uniqueLights = new Set<string>();
    for (const light of lights) {
      const key = `${light.deviceId}-${light.model}`;
      if (uniqueLights.has(key)) {
        throw new Error(`Duplicate light found: ${light.name}`);
      }
      uniqueLights.add(key);
    }

    return new LightGroup(id, name, new Set(lights));
  }

  get id(): string {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get lights(): Light[] {
    return Array.from(this._lights);
  }

  get size(): number {
    return this._lights.size;
  }

  get isEmpty(): boolean {
    return this._lights.size === 0;
  }

  get onlineCount(): number {
    return Array.from(this._lights).filter((light) => light.isOnline).length;
  }

  get onCount(): number {
    return Array.from(this._lights).filter((light) => light.isOn).length;
  }

  addLight(light: Light): void {
    // Silently ignore duplicates - Set will handle uniqueness
    this._lights.add(light);
  }

  removeLight(light: Light): void {
    // Silently ignore removal of non-existent lights
    this._lights.delete(light);
  }

  hasLight(light: Light): boolean {
    return Array.from(this._lights).some((l) => l.equals(light));
  }

  getControllableLights(): Light[] {
    return Array.from(this._lights).filter((light) => light.canBeControlled());
  }

  canBeControlled(): boolean {
    return this.getControllableLights().length > 0;
  }

  /**
   * Get a summary of the group's current state
   */
  getStateSummary(): {
    allOn: boolean;
    allOff: boolean;
    mixedState: boolean;
    allOnline: boolean;
    someOffline: boolean;
    onCount: number;
    offCount: number;
    totalCount: number;
  } {
    const controllableLights = this.getControllableLights();
    const onCount = controllableLights.filter((l) => l.isOn).length;
    const offCount = controllableLights.filter((l) => !l.isOn).length;
    const totalControllable = controllableLights.length;
    const totalLights = this._lights.size;

    return {
      allOn: onCount === totalControllable && totalControllable > 0,
      allOff: onCount === 0,
      mixedState: onCount > 0 && onCount < totalControllable,
      allOnline: this.onlineCount === totalLights,
      someOffline: this.onlineCount < totalLights,
      onCount,
      offCount,
      totalCount: totalControllable,
    };
  }

  equals(other: LightGroup): boolean {
    return this._id === other._id;
  }

  toString(): string {
    const stateSummary = this.getStateSummary();
    let stateDesc = "mixed";
    if (stateSummary.allOn) stateDesc = "all on";
    else if (stateSummary.allOff) stateDesc = "all off";

    return `LightGroup(${this._id}, ${this._name}, ${this.size} lights, ${stateDesc})`;
  }
}
