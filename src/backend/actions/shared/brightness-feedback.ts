import type { FeedbackPayload } from "@elgato/streamdeck";
import type { BaseSettings, DeviceTarget } from "./ActionServices";

/** Presentation state only; target resolution remains in the action's live sync. */
export class BrightnessFeedback {
  private targets = new Map<string, { id: string; name?: string }>();
  private sent = new Map<string, string>();

  reset(ctx: string): void {
    this.targets.delete(ctx);
    this.sent.delete(ctx);
  }

  beginSync(ctx: string, settings: BaseSettings): void {
    const id = settings.selectedDeviceId ?? "";
    if (this.targets.get(ctx)?.id !== id) this.targets.set(ctx, { id });
  }

  setTarget(
    ctx: string,
    settings: BaseSettings,
    target: DeviceTarget | null,
  ): void {
    this.targets.set(ctx, {
      id: settings.selectedDeviceId ?? "",
      name: target?.light?.name ?? target?.group?.name,
    });
  }

  async render(
    action: {
      id: string;
      setFeedback(payload: FeedbackPayload): Promise<void>;
    },
    settings: BaseSettings,
    value: string,
    barValue: number,
  ): Promise<void> {
    const target = this.targets.get(action.id);
    const name =
      target?.id === settings.selectedDeviceId ? target?.name : undefined;
    const text =
      name?.trim() ||
      (settings.selectedDeviceId ? "Light unavailable" : "Select a light");
    // Bound the default header; the host handles custom title font/width clipping.
    const characters = Array.from(text.replace(/\s+/g, " "));
    const title =
      characters.length > 24
        ? characters.slice(0, 23).join("") + "…"
        : characters.join("");
    const feedback = { title, value, bar: { value: barValue } };
    const signature = JSON.stringify(feedback);
    if (this.sent.get(action.id) === signature) return;
    await action.setFeedback(feedback);
    this.sent.set(action.id, signature);
  }
}
