export class DynamicSceneOption {
  private constructor(
    private readonly _id: number,
    private readonly _paramId: number,
    private readonly _name: string,
  ) {}

  static create(id: number, paramId: number, name: string): DynamicSceneOption {
    if (!Number.isInteger(id)) {
      throw new Error("Scene ID must be an integer");
    }

    if (!Number.isInteger(paramId)) {
      throw new Error("Scene param ID must be an integer");
    }

    if (!name?.trim()) {
      throw new Error("Scene name is required");
    }

    return new DynamicSceneOption(id, paramId, name.trim());
  }

  get id(): number {
    return this._id;
  }

  get paramId(): number {
    return this._paramId;
  }

  get name(): string {
    return this._name;
  }

  equals(other: DynamicSceneOption): boolean {
    return (
      this._id === other._id &&
      this._paramId === other._paramId &&
      this._name === other._name
    );
  }

  toJSON(): { id: number; paramId: number; name: string } {
    return {
      id: this._id,
      paramId: this._paramId,
      name: this._name,
    };
  }
}
