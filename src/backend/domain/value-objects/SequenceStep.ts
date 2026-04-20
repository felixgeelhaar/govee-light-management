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
  | "snapshot";

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

export interface ActionStepProps {
  targetId: string;
  targetType: StepTarget;
  command: StepCommand;
  commandValue?: number | string;
  scenePayload?: ScenePayload;
  snapshotPayload?: SnapshotPayload;
}

export interface SequenceStepJSON {
  type: StepType;
  targetId?: string;
  targetType?: StepTarget;
  command?: StepCommand;
  commandValue?: number | string;
  scenePayload?: ScenePayload;
  snapshotPayload?: SnapshotPayload;
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
 *  - Structured: "scene" (uses scenePayload), "snapshot" (uses snapshotPayload)
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
    return new SequenceStep(StepType.Action, {
      targetId: props.targetId,
      targetType: props.targetType,
      command: props.command,
      commandValue: props.commandValue,
      scenePayload: props.scenePayload,
      snapshotPayload: props.snapshotPayload,
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
      });
    }
    return SequenceStep.delay(json.durationMs!);
  }
}
