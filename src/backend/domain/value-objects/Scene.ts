/**
 * Scene value object representing a Govee light scene
 * Supports dynamic scenes (Sunrise, Sunset, Rainbow) and preset scenes (Nightlight, Movie, Reading)
 */

/**
 * Scene type classification
 * - dynamic: Animated scenes with color transitions (Sunrise, Sunset, Rainbow, Aurora)
 * - preset: Static preset scenes (Movie, Reading, Nightlight)
 * - custom: User-defined custom scenes
 */
export type SceneType = 'dynamic' | 'preset' | 'custom';

export class Scene {
  private constructor(
    private readonly _id: string,
    private readonly _name: string,
    private readonly _type: SceneType
  ) {}

  /**
   * Create a new Scene instance
   * @param id Unique scene identifier (e.g., 'sunrise', 'sunset')
   * @param name Human-readable scene name (e.g., 'Sunrise', 'Sunset')
   * @param type Scene type classification
   * @throws Error if any parameter is empty or invalid
   */
  static create(id: string, name: string, type: SceneType): Scene {
    if (!id?.trim()) {
      throw new Error('Scene ID is required');
    }
    if (!name?.trim()) {
      throw new Error('Scene name is required');
    }
    if (!type?.trim()) {
      throw new Error('Scene type is required');
    }

    return new Scene(id.trim(), name.trim(), type);
  }

  /**
   * Predefined scene: Sunrise (warm color transition)
   */
  static sunrise(): Scene {
    return Scene.create('sunrise', 'Sunrise', 'dynamic');
  }

  /**
   * Predefined scene: Sunset (warm to cool color transition)
   */
  static sunset(): Scene {
    return Scene.create('sunset', 'Sunset', 'dynamic');
  }

  /**
   * Predefined scene: Rainbow (full color spectrum animation)
   */
  static rainbow(): Scene {
    return Scene.create('rainbow', 'Rainbow', 'dynamic');
  }

  /**
   * Predefined scene: Aurora (northern lights effect)
   */
  static aurora(): Scene {
    return Scene.create('aurora', 'Aurora', 'dynamic');
  }

  /**
   * Predefined scene: Movie (theater-optimized lighting)
   */
  static movie(): Scene {
    return Scene.create('movie', 'Movie', 'preset');
  }

  /**
   * Predefined scene: Reading (bright, focused lighting)
   */
  static reading(): Scene {
    return Scene.create('reading', 'Reading', 'preset');
  }

  /**
   * Predefined scene: Nightlight (dim, warm lighting)
   */
  static nightlight(): Scene {
    return Scene.create('nightlight', 'Nightlight', 'preset');
  }

  get id(): string {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get type(): SceneType {
    return this._type;
  }

  /**
   * Check equality with another Scene based on ID
   */
  equals(other: Scene): boolean {
    return this._id === other._id;
  }

  /**
   * Serialize to plain object for storage/transmission
   */
  toJSON(): { id: string; name: string; type: SceneType } {
    return {
      id: this._id,
      name: this._name,
      type: this._type
    };
  }

  /**
   * Deserialize from plain object
   * @param data Plain object with scene data
   * @throws Error if data is invalid
   */
  static fromJSON(data: { id: string; name: string; type: SceneType }): Scene {
    return Scene.create(data.id, data.name, data.type);
  }

  /**
   * Human-readable string representation
   */
  toString(): string {
    return `Scene(${this._id}: ${this._name} [${this._type}])`;
  }
}
