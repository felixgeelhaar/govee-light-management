import { streamDeck } from "@elgato/streamdeck";
import {
  Brightness,
  ColorRgb,
  ColorTemperature,
  DiyScene,
  LightScene,
  Snapshot,
} from "@felixgeelhaar/govee-api-client";
import { Sequence } from "../domain/entities/Sequence";
import { SequenceStep, StepType } from "../domain/value-objects/SequenceStep";
import { SequenceExecutor } from "../domain/services/SequenceExecutor";
import { ActionServices } from "../actions/shared/ActionServices";
import { globalSettingsService } from "./GlobalSettingsService";

/**
 * Plugin-level service coordinating sequence execution.
 * Wires the domain SequenceExecutor to actual light control.
 */
class SequenceServiceImpl {
  private actionServices = new ActionServices();
  private executor: SequenceExecutor;
  private initialized = false;

  constructor() {
    this.executor = new SequenceExecutor((step) => this.executeStep(step), {
      stopOnError: false,
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
  }

  /**
   * Execute a sequence. Resolves API key and light services first.
   */
  async executeSequence(sequence: Sequence): Promise<void> {
    const apiKey = await globalSettingsService.getApiKey();
    if (!apiKey) {
      throw new Error("No API key configured");
    }
    await this.actionServices.ensureServices(apiKey);
    await this.executor.execute(sequence);
  }

  cancel(sequenceId: string): boolean {
    return this.executor.cancel(sequenceId);
  }

  isRunning(sequenceId: string): boolean {
    return this.executor.isRunning(sequenceId);
  }

  /**
   * Execute a single step by dispatching to LightControlService.
   */
  private async executeStep(step: SequenceStep): Promise<void> {
    if (step.type !== StepType.Action) return;

    const target = await this.actionServices.resolveTarget({
      selectedDeviceId: step.targetId,
    });
    if (!target) {
      streamDeck.logger?.warn(
        `Sequence step skipped: target ${step.targetId} not found`,
      );
      return;
    }

    const value = this.resolveCommandValue(step.command, step.commandValue);

    if (step.command === "toggle") {
      const nextState =
        target.type === "light" && target.light?.isOn ? "off" : "on";
      await this.actionServices.controlTarget(target, nextState);
      return;
    }

    if (
      step.command === "on" ||
      step.command === "off" ||
      step.command === "brightness" ||
      step.command === "color" ||
      step.command === "colorTemperature"
    ) {
      await this.actionServices.controlTarget(target, step.command, value);
      return;
    }

    if (step.command === "scene" && step.scenePayload) {
      const payload = step.scenePayload;
      const lights =
        target.type === "light" && target.light
          ? [target.light]
          : (target.group?.getControllableLights() ?? []);
      for (const light of lights) {
        try {
          if (payload.kind === "diy") {
            const scene = new DiyScene(
              payload.id,
              payload.paramId,
              payload.name,
            );
            await this.actionServices.applyDiyScene(light, scene);
          } else {
            const scene = new LightScene(
              payload.id,
              payload.paramId,
              payload.name,
            );
            await this.actionServices.applyDynamicScene(light, scene);
          }
        } catch (error) {
          streamDeck.logger?.warn(
            `Sequence scene step failed for ${light.name}:`,
            error,
          );
        }
      }
      return;
    }

    if (step.command === "snapshot" && step.snapshotPayload) {
      const payload = step.snapshotPayload;
      const snapshot = new Snapshot(payload.id, payload.paramId, payload.name);
      const lights =
        target.type === "light" && target.light
          ? [target.light]
          : (target.group?.getControllableLights() ?? []);
      for (const light of lights) {
        try {
          await this.actionServices.applySnapshot(light, snapshot);
        } catch (error) {
          streamDeck.logger?.warn(
            `Sequence snapshot step failed for ${light.name}:`,
            error,
          );
        }
      }
    }
  }

  private resolveCommandValue(
    command: string | undefined,
    raw: number | string | undefined,
  ): Brightness | ColorRgb | ColorTemperature | undefined {
    if (!command || raw === undefined) return undefined;
    try {
      if (command === "brightness" && typeof raw === "number") {
        return new Brightness(raw);
      }
      if (command === "color" && typeof raw === "string") {
        return ColorRgb.fromHex(raw);
      }
      if (command === "colorTemperature" && typeof raw === "number") {
        return new ColorTemperature(raw);
      }
    } catch (error) {
      streamDeck.logger?.warn(
        `Invalid command value for ${command}: ${raw}`,
        error,
      );
    }
    return undefined;
  }
}

export const sequenceService = new SequenceServiceImpl();
