/**
 * Parsing + dispatch helpers for the Recall composite action. Extracted
 * from RecallAction so the logic is unit-testable without instantiating
 * the @action-decorated class (vitest's transform pipeline trips on
 * stage-3 decorators in test imports).
 */
import { DynamicSceneOption } from "../domain/value-objects/DynamicSceneOption";
import { DiySceneOption } from "../domain/value-objects/DiySceneOption";
import { SnapshotOption } from "../domain/value-objects/SnapshotOption";
import type { Light } from "../domain/entities/Light";

export type RecallPayload =
  | {
      kind: "scene";
      sceneKind: "dynamic" | "diy";
      id: number;
      paramId: number;
      name: string;
    }
  | {
      kind: "snapshot";
      id: number;
      paramId: number;
      name: string;
    };

export function parseRecallPayload(raw: string): RecallPayload | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const candidate = parsed as Record<string, unknown>;
    if (
      typeof candidate.id !== "number" ||
      typeof candidate.paramId !== "number" ||
      typeof candidate.name !== "string"
    ) {
      return null;
    }
    if (candidate.kind === "scene") {
      const sceneKind = candidate.sceneKind === "diy" ? "diy" : "dynamic";
      return {
        kind: "scene",
        sceneKind,
        id: candidate.id,
        paramId: candidate.paramId,
        name: candidate.name,
      };
    }
    if (candidate.kind === "snapshot") {
      return {
        kind: "snapshot",
        id: candidate.id,
        paramId: candidate.paramId,
        name: candidate.name,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Slim subset of `ActionServices` that the dispatcher needs. Lets unit
 * tests stub the three apply methods without touching the action class.
 */
export interface RecallApplyServices {
  applyDynamicScene(light: Light, scene: DynamicSceneOption): Promise<void>;
  applyDiyScene(light: Light, scene: DiySceneOption): Promise<void>;
  applySnapshot(light: Light, snapshot: SnapshotOption): Promise<void>;
}

/**
 * Dispatch the parsed payload onto the right apply path. Throws if the
 * underlying apply call throws — caller decides whether to swallow per
 * group member or propagate.
 */
export async function applyRecallToLight(
  services: RecallApplyServices,
  light: Light,
  payload: RecallPayload,
): Promise<void> {
  if (payload.kind === "scene" && payload.sceneKind === "diy") {
    await services.applyDiyScene(
      light,
      DiySceneOption.create(payload.id, payload.paramId, payload.name),
    );
    return;
  }
  if (payload.kind === "scene") {
    await services.applyDynamicScene(
      light,
      DynamicSceneOption.create(payload.id, payload.paramId, payload.name),
    );
    return;
  }
  await services.applySnapshot(
    light,
    SnapshotOption.create(payload.id, payload.paramId, payload.name),
  );
}
