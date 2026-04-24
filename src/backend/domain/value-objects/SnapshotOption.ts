export class SnapshotOption {
  private constructor(
    private readonly _id: number,
    private readonly _paramId: number,
    private readonly _name: string,
  ) {}

  static create(id: number, paramId: number, name: string): SnapshotOption {
    if (!Number.isInteger(id)) {
      throw new Error("Snapshot ID must be an integer");
    }

    if (!Number.isInteger(paramId)) {
      throw new Error("Snapshot param ID must be an integer");
    }

    if (!name?.trim()) {
      throw new Error("Snapshot name is required");
    }

    return new SnapshotOption(id, paramId, name.trim());
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

  equals(other: SnapshotOption): boolean {
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
