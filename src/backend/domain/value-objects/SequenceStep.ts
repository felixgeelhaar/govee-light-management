export enum StepType {
  Action = "action",
  Delay = "delay",
}

export type StepTarget = "light" | "group";

export type StepCommand =
  | "on"
  | "off"
  | "toggle"
  | "brightness"
  | "color"
  | "colorTemperature"
  | "scene"
  | "snapshot"
  | "music-mode"
  | "feature-toggle"
  | "segment-color"
  | "effect";

/** Structured payload for a scene step (dynamic or user-created DIY). */
export interface ScenePayload {
  kind: "dynamic" | "diy";
  id: number;
  paramId: number;
  name: string;
}

/** Structured payload for a snapshot step. */
export interface SnapshotPayload {
  id: number;
  paramId: number;
  name: string;
}

/** Structured payload for a music-mode step. */
export interface MusicModePayload {
  modeId: number;
  name: string;
  /** Audio sensitivity (0-100). */
  sensitivity: number;
}

/** Structured payload for a feature-toggle step (nightlight / gradient / DreamView / etc.). */
export interface TogglePayload {
  /** Govee capability instance, e.g. "gradientToggle". */
  instance: string;
  /** Human-readable label for display. */
  name: string;
  /** Target state to apply. */
  enabled: boolean;
}

/** Structured payload for a segment-color step (RGB IC lights only). */
export interface SegmentColorPayload {
  /** Per-segment overrides: 1-15 segments, values 0-14. */
  segments: Array<{ index: number; hex: string }>;
}

/** Structured payload for an RGB effect preset step. */
export interface EffectPayload {
  presetId: string;
  name: string;
}

export interface ActionStepProps {
  targetId: string;
  targetType: StepTarget;
  command: StepCommand;
  commandValue?: number | string;
  scenePayload?: ScenePayload;
  snapshotPayload?: SnapshotPayload;
  musicModePayload?: MusicModePayload;
  togglePayload?: TogglePayload;
  segmentColorPayload?: SegmentColorPayload;
  effectPayload?: EffectPayload;
}

export interface SequenceStepJSON {
  type: StepType;
  targetId?: string;
  targetType?: StepTarget;
  command?: StepCommand;
  commandValue?: number | string;
  scenePayload?: ScenePayload;
  snapshotPayload?: SnapshotPayload;
  musicModePayload?: MusicModePayload;
  togglePayload?: TogglePayload;
  segmentColorPayload?: SegmentColorPayload;
  effectPayload?: EffectPayload;
  durationMs?: number;
}

/**
 * Immutable sequence step value object.
 * Represents either a light action or a timing delay.
 *
 * Supported action commands:
 *  - Power: "on", "off", "toggle"
 *  - Scalar-valued: "brightness" (0-100), "color" (hex string),
 *    "colorTemperature" (kelvin number)
 *  - Structured: "scene" (scenePayload), "snapshot" (snapshotPayload),
 *    "music-mode" (musicModePayload), "feature-toggle" (togglePayload),
 *    "segment-color" (segmentColorPayload), "effect" (effectPayload)
 *
 * The structured payload shape is used for commands whose domain value
 * doesn't fit a simple scalar. Older JSON blobs without these fields
 * continue to deserialize cleanly since they always use `commandValue`.
 */
export class SequenceStep {
  private constructor(
    public readonly type: StepType,
    private readonly data: {
      targetId?: string;
      targetType?: StepTarget;
      command?: StepCommand;
      commandValue?: number | string;
      scenePayload?: ScenePayload;
      snapshotPayload?: SnapshotPayload;
      musicModePayload?: MusicModePayload;
      togglePayload?: TogglePayload;
      segmentColorPayload?: SegmentColorPayload;
      effectPayload?: EffectPayload;
      durationMs?: number;
    },
  ) {}

  // ─── Factory Methods ─────────────────────────────────────

  static action(props: ActionStepProps): SequenceStep {
    if (!props.targetId || props.targetId.trim() === "") {
      throw new Error("Target ID cannot be empty");
    }
    if (props.command === "scene" && !props.scenePayload) {
      throw new Error("Scene step requires scenePayload");
    }
    if (props.command === "snapshot" && !props.snapshotPayload) {
      throw new Error("Snapshot step requires snapshotPayload");
    }
    if (props.command === "music-mode" && !props.musicModePayload) {
      throw new Error("Music mode step requires musicModePayload");
    }
    if (props.command === "feature-toggle" && !props.togglePayload) {
      throw new Error("Feature toggle step requires togglePayload");
    }
    if (props.command === "segment-color" && !props.segmentColorPayload) {
      throw new Error("Segment color step requires segmentColorPayload");
    }
    if (props.command === "effect" && !props.effectPayload) {
      throw new Error("Effect step requires effectPayload");
    }
    return new SequenceStep(StepType.Action, {
      targetId: props.targetId,
      targetType: props.targetType,
      command: props.command,
      commandValue: props.commandValue,
      scenePayload: props.scenePayload,
      snapshotPayload: props.snapshotPayload,
      musicModePayload: props.musicModePayload,
      togglePayload: props.togglePayload,
      segmentColorPayload: props.segmentColorPayload,
      effectPayload: props.effectPayload,
    });
  }

  static scene(
    targetId: string,
    targetType: StepTarget,
    payload: ScenePayload,
  ): SequenceStep {
    if (!["dynamic", "diy"].includes(payload.kind)) {
      throw new Error(`Invalid scene kind: ${payload.kind}`);
    }
    if (!Number.isInteger(payload.id) || payload.id <= 0) {
      throw new Error(`Invalid scene id: ${payload.id}`);
    }
    return SequenceStep.action({
      targetId,
      targetType,
      command: "scene",
      scenePayload: payload,
    });
  }

  static snapshot(
    targetId: string,
    targetType: StepTarget,
    payload: SnapshotPayload,
  ): SequenceStep {
    if (!Number.isInteger(payload.id) || payload.id <= 0) {
      throw new Error(`Invalid snapshot id: ${payload.id}`);
    }
    return SequenceStep.action({
      targetId,
      targetType,
      command: "snapshot",
      snapshotPayload: payload,
    });
  }

  static musicMode(
    targetId: string,
    targetType: StepTarget,
    payload: MusicModePayload,
  ): SequenceStep {
    if (!Number.isInteger(payload.modeId) || payload.modeId <= 0) {
      throw new Error(`Invalid music mode id: ${payload.modeId}`);
    }
    if (
      !Number.isFinite(payload.sensitivity) ||
      payload.sensitivity < 0 ||
      payload.sensitivity > 100
    ) {
      throw new Error(
        `Music mode sensitivity must be 0-100 (got ${payload.sensitivity})`,
      );
    }
    return SequenceStep.action({
      targetId,
      targetType,
      command: "music-mode",
      musicModePayload: payload,
    });
  }

  static featureToggle(
    targetId: string,
    targetType: StepTarget,
    payload: TogglePayload,
  ): SequenceStep {
    if (!payload.instance || payload.instance.trim() === "") {
      throw new Error("Feature toggle instance cannot be empty");
    }
    return SequenceStep.action({
      targetId,
      targetType,
      command: "feature-toggle",
      togglePayload: payload,
    });
  }

  static segmentColor(
    targetId: string,
    targetType: StepTarget,
    payload: SegmentColorPayload,
  ): SequenceStep {
    if (!Array.isArray(payload.segments) || payload.segments.length === 0) {
      throw new Error("Segment color step requires at least one segment");
    }
    for (const segment of payload.segments) {
      if (
        !Number.isInteger(segment.index) ||
        segment.index < 0 ||
        segment.index > 14
      ) {
        throw new Error(
          `Segment index must be an integer 0-14 (got ${segment.index})`,
        );
      }
      if (!/^#[0-9A-Fa-f]{6}$/.test(segment.hex)) {
        throw new Error(`Segment hex color invalid: ${segment.hex}`);
      }
    }
    return SequenceStep.action({
      targetId,
      targetType,
      command: "segment-color",
      segmentColorPayload: payload,
    });
  }

  static effect(
    targetId: string,
    targetType: StepTarget,
    payload: EffectPayload,
  ): SequenceStep {
    if (!payload.presetId || payload.presetId.trim() === "") {
      throw new Error("Effect step requires a preset id");
    }
    return SequenceStep.action({
      targetId,
      targetType,
      command: "effect",
      effectPayload: payload,
    });
  }

  static delay(durationMs: number): SequenceStep {
    if (durationMs <= 0) {
      throw new Error("Delay duration must be positive");
    }
    if (durationMs > 300_000) {
      throw new Error("Delay duration must be 5 minutes or less");
    }
    return new SequenceStep(StepType.Delay, { durationMs });
  }

  // ─── Action Step Properties ──────────────────────────────

  get targetId(): string | undefined {
    return this.data.targetId;
  }

  get targetType(): StepTarget | undefined {
    return this.data.targetType;
  }

  get command(): StepCommand | undefined {
    return this.data.command;
  }

  get commandValue(): number | string | undefined {
    return this.data.commandValue;
  }

  get scenePayload(): ScenePayload | undefined {
    return this.data.scenePayload;
  }

  get snapshotPayload(): SnapshotPayload | undefined {
    return this.data.snapshotPayload;
  }

  get musicModePayload(): MusicModePayload | undefined {
    return this.data.musicModePayload;
  }

  get togglePayload(): TogglePayload | undefined {
    return this.data.togglePayload;
  }

  get segmentColorPayload(): SegmentColorPayload | undefined {
    return this.data.segmentColorPayload;
  }

  get effectPayload(): EffectPayload | undefined {
    return this.data.effectPayload;
  }

  // ─── Delay Step Properties ───────────────────────────────

  get durationMs(): number | undefined {
    return this.data.durationMs;
  }

  // ─── Serialization ───────────────────────────────────────

  toJSON(): SequenceStepJSON {
    return {
      type: this.type,
      targetId: this.data.targetId,
      targetType: this.data.targetType,
      command: this.data.command,
      commandValue: this.data.commandValue,
      scenePayload: this.data.scenePayload,
      snapshotPayload: this.data.snapshotPayload,
      musicModePayload: this.data.musicModePayload,
      togglePayload: this.data.togglePayload,
      segmentColorPayload: this.data.segmentColorPayload,
      effectPayload: this.data.effectPayload,
      durationMs: this.data.durationMs,
    };
  }

  static fromJSON(json: SequenceStepJSON): SequenceStep {
    if (json.type === StepType.Action) {
      return SequenceStep.action({
        targetId: json.targetId!,
        targetType: json.targetType!,
        command: json.command!,
        commandValue: json.commandValue,
        scenePayload: json.scenePayload,
        snapshotPayload: json.snapshotPayload,
        musicModePayload: json.musicModePayload,
        togglePayload: json.togglePayload,
        segmentColorPayload: json.segmentColorPayload,
        effectPayload: json.effectPayload,
      });
    }
    return SequenceStep.delay(json.durationMs!);
  }
}
