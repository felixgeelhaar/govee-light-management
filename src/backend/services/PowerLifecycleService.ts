import {
  normalizePowerRules,
  canonicalPowerTarget,
  type PowerEvent,
  type PowerLifecycleRule,
} from "../../shared/power-lifecycle";
import type { DeviceTarget } from "../actions/shared/ActionServices";
import type { FanOutOutcome } from "../domain/services/group-fan-out";

export interface PowerEventSource {
  start(
    onEvent: (event: PowerEvent) => void,
    onFailure: () => void,
  ): Promise<void>;
  stop(): void;
}
/** Confirms that a wake event follows a real suspension. */
export interface SuspensionSignal {
  start(): void;
  stop(): void;
  recentlySuspended(): boolean;
}
interface Dependencies {
  getApiKey(): Promise<string | undefined>;
  resolveTarget(
    selectedDeviceId: string,
    signal: AbortSignal,
  ): Promise<DeviceTarget | null>;
  setPower(
    target: DeviceTarget,
    isOn: boolean,
    signal: AbortSignal,
    apiKey: string,
  ): Promise<FanOutOutcome>;
  events: PowerEventSource;
  suspension?: SuspensionSignal;
  log(record: {
    event?: PowerEvent;
    target?: string;
    category: string;
    total?: number;
    failed?: number;
  }): void;
}
interface Task {
  controller: AbortController;
  deadlineAt: number;
  target?: DeviceTarget;
  timer: ReturnType<typeof setTimeout>;
}
const matchesEvent = (rule: PowerLifecycleRule, event: PowerEvent) =>
  rule.enabled &&
  {
    startup: rule.onPluginStart,
    wake: rule.onWake,
    sleep: rule.offBeforeSleep,
    shutdown: rule.offBeforeShutdown,
  }[event];
const targetIds = (target: DeviceTarget): string[] =>
  target.light
    ? [`light:${target.light.deviceId}|${target.light.model}`]
    : target.group
      ? [
          `group:${target.group.id}`,
          ...target.group.lights.map(
            (light) => `light:${light.deviceId}|${light.model}`,
          ),
        ]
      : [];
const category = (error: unknown): string => {
  const allowed = [
    "network",
    "timeout",
    "auth",
    "rate_limit",
    "validation",
    "cancelled",
  ];
  const value =
    error && typeof error === "object" && "category" in error
      ? error.category
      : undefined;
  return typeof value === "string" && allowed.includes(value)
    ? value
    : "failed";
};
function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    if (signal.aborted) {
      work.catch(() => {});
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    work
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}
function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
}

/** Event-driven automation independent of key visibility; disabled by default. */
export class PowerLifecycleService {
  private rules: PowerLifecycleRule[] = [];
  private tasks = new Map<string, Task>();
  private prepared = new Map<string, DeviceTarget>();
  private warming = new Map<string, Task & { promise: Promise<void> }>();
  private recent = new Map<string, { isOn: boolean; at: number }>();
  private stopped = false;
  private helperGeneration = 0;
  private hookEnabled = false;
  helperStatus: "disabled" | "starting" | "ready" | "unavailable" = "disabled";

  constructor(private readonly deps: Dependencies) {
    deps.suspension?.start();
  }

  configure(value: unknown): void {
    if (this.stopped) return;
    const rules = normalizePowerRules(value);
    if (JSON.stringify(rules) === JSON.stringify(this.rules)) return;
    this.abortAll("settings_changed");
    this.recent.clear();
    this.rules = rules;
    const activeIds = new Set(
      rules.filter((rule) => rule.enabled).map((rule) => rule.selectedDeviceId),
    );
    for (const id of this.prepared.keys())
      if (!activeIds.has(id)) this.prepared.delete(id);
    const enabled = rules.some(
      (rule) => rule.enabled && (rule.offBeforeSleep || rule.offBeforeShutdown),
    );
    if (enabled === this.hookEnabled) return;
    this.hookEnabled = enabled;
    const generation = ++this.helperGeneration;
    if (!enabled) {
      this.deps.events.stop();
      this.helperStatus = "disabled";
      return;
    }
    this.helperStatus = "starting";
    const failed = () => {
      if (generation !== this.helperGeneration || this.stopped) return;
      this.helperStatus = "unavailable";
      this.deps.log({ category: "helper_unavailable" });
    };
    void this.deps.events
      .start((event) => {
        void this.handle(event);
      }, failed)
      .then(() => {
        if (generation === this.helperGeneration && !this.stopped)
          this.helperStatus = "ready";
      })
      .catch(failed);
  }

  async handle(event: PowerEvent): Promise<void> {
    if (this.stopped) return;
    this.deps.log({ event, category: "event_received" });
    // The host also reports a display wake as a system wake.
    if (
      event === "wake" &&
      this.deps.suspension?.recentlySuspended() === false
    ) {
      this.deps.log({ event, category: "wake_ignored_not_suspended" });
      return;
    }
    const isOn = event === "startup" || event === "wake";
    // An opposite transition must cancel old requests before issuing new ones.
    for (const [id, task] of this.tasks) {
      if (this.recent.get(id)?.isOn !== isOn)
        task.controller.abort("transition");
    }
    const work: Promise<void>[] = [];
    for (const rule of this.rules.filter((rule) => matchesEvent(rule, event))) {
      const id = rule.selectedDeviceId;
      const previous = this.recent.get(id);
      if (previous?.isOn === isOn && Date.now() - previous.at < 5000) continue;
      this.tasks.get(id)?.controller.abort("superseded");
      this.recent.set(id, { isOn, at: Date.now() });
      const controller = new AbortController();
      const task: Task = {
        controller,
        deadlineAt: Date.now() + (isOn ? 15000 : 1500),
        timer: setTimeout(
          () => controller.abort("timeout"),
          isOn ? 15000 : 1500,
        ),
      };
      this.tasks.set(id, task);
      work.push(this.run(rule, event, isOn, task));
    }
    await Promise.all(work);
  }

  manualOverrideSelection(
    selectedDeviceId: unknown,
    selectedModel?: unknown,
  ): void {
    const value =
      typeof selectedDeviceId === "string" &&
      !selectedDeviceId.includes("|") &&
      !selectedDeviceId.startsWith("group:") &&
      typeof selectedModel === "string"
        ? `${selectedDeviceId}|${selectedModel}`
        : selectedDeviceId;
    const id = canonicalPowerTarget(value);
    if (!id) return;
    for (const [targetId, task] of this.tasks) {
      const resolved = task.target ?? this.prepared.get(targetId);
      if (
        id === targetId ||
        (resolved && targetIds(resolved).includes(id)) ||
        (!resolved && targetId.startsWith("group:"))
      )
        task.controller.abort("manual_override");
    }
  }

  manualOverride(target: DeviceTarget): void {
    const ids = new Set(targetIds(target));
    for (const [id, task] of this.tasks) {
      if (
        ids.has(id) ||
        (task.target &&
          targetIds(task.target).some((member) => ids.has(member))) ||
        (!task.target && id.startsWith("group:"))
      ) {
        task.controller.abort("manual_override");
      }
    }
  }

  /** Resolve before sleep, while Wi-Fi/discovery is available; never sends power. */
  async prepareTargets(): Promise<void> {
    if (this.stopped) return;
    await Promise.all(
      this.rules
        .filter(
          (rule) =>
            rule.enabled && (rule.offBeforeSleep || rule.offBeforeShutdown),
        )
        .map((rule) => {
          const id = rule.selectedDeviceId;
          if (this.prepared.has(id)) return Promise.resolve();
          const existing = this.warming.get(id);
          if (existing) return existing.promise;
          const controller = new AbortController();
          const task = {
            controller,
            deadlineAt: Date.now() + 15000,
            timer: setTimeout(() => controller.abort("timeout"), 15000),
            promise: Promise.resolve(),
          };
          this.warming.set(id, task);
          task.promise = abortable(
            (async () => {
              const key = await this.deps.getApiKey();
              this.assertActive(task);
              if (!key) return;
              const target = await this.deps.resolveTarget(
                id,
                controller.signal,
              );
              this.assertActive(task);
              if (target) this.prepared.set(id, target);
            })(),
            controller.signal,
          )
            .catch(() => {
              if (!controller.signal.aborted)
                this.deps.log({ target: id, category: "prepare_failed" });
            })
            .finally(() => {
              clearTimeout(task.timer);
              if (this.warming.get(id) === task) this.warming.delete(id);
            });
          return task.promise;
        }),
    );
  }

  invalidatePreparedTargets(): void {
    this.abortAll("target_changed");
    this.prepared.clear();
    this.recent.clear();
  }

  credentialsChanged(): void {
    this.abortAll("credentials_changed");
    this.prepared.clear();
    this.recent.clear();
  }

  shutdown(): void {
    this.stopped = true;
    ++this.helperGeneration;
    this.abortAll("unload");
    this.deps.events.stop();
    this.deps.suspension?.stop();
    this.helperStatus = "disabled";
  }

  private abortAll(reason: string): void {
    for (const task of [...this.tasks.values(), ...this.warming.values()])
      task.controller.abort(reason);
    this.warming.clear();
  }

  private async run(
    rule: PowerLifecycleRule,
    event: PowerEvent,
    isOn: boolean,
    task: Task,
  ): Promise<void> {
    const signal = task.controller.signal;
    try {
      await abortable(this.execute(rule, event, isOn, task), signal);
    } catch (error) {
      if (!signal.aborted)
        this.deps.log({
          event,
          target: rule.selectedDeviceId,
          category: category(error),
        });
      if (signal.reason === "timeout")
        this.deps.log({
          event,
          target: rule.selectedDeviceId,
          category: "timeout",
        });
    } finally {
      clearTimeout(task.timer);
      if (this.tasks.get(rule.selectedDeviceId) === task)
        this.tasks.delete(rule.selectedDeviceId);
    }
  }

  private assertActive(task: Task): void {
    if (Date.now() >= task.deadlineAt) task.controller.abort("timeout");
    task.controller.signal.throwIfAborted();
  }

  private async execute(
    rule: PowerLifecycleRule,
    event: PowerEvent,
    isOn: boolean,
    task: Task,
  ): Promise<void> {
    const signal = task.controller.signal;
    const apiKey = await this.deps.getApiKey();
    this.assertActive(task);
    if (!apiKey) {
      this.deps.log({
        event,
        target: rule.selectedDeviceId,
        category: "missing_key",
      });
      return;
    }
    for (let attempt = 0; attempt < (isOn ? 2 : 1); attempt++) {
      try {
        const target =
          (!isOn ? this.prepared.get(rule.selectedDeviceId) : undefined) ??
          (await this.deps.resolveTarget(rule.selectedDeviceId, signal));
        this.assertActive(task);
        if (!target) {
          this.deps.log({
            event,
            target: rule.selectedDeviceId,
            category: "missing_target",
          });
          return;
        }
        task.target = target;
        this.prepared.set(rule.selectedDeviceId, target);
        this.deps.log({
          event,
          target: rule.selectedDeviceId,
          category: "command_started",
        });
        const outcome = await this.deps.setPower(target, isOn, signal, apiKey);
        this.assertActive(task);
        this.deps.log({
          event,
          target: rule.selectedDeviceId,
          category: outcome.failed.length ? "partial" : "ok",
          total: outcome.total,
          failed: outcome.failed.length,
        });
        return;
      } catch (error) {
        if (signal.aborted) return;
        const kind = category(error);
        this.deps.log({ event, target: rule.selectedDeviceId, category: kind });
        if (!isOn || attempt === 1 || !["network", "timeout"].includes(kind))
          return;
        await delay(3000, signal);
      }
    }
  }
}
