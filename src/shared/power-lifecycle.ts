export type PowerEvent = "startup" | "wake" | "sleep" | "shutdown";
export interface PowerLifecycleRule {
  selectedDeviceId: string;
  enabled: boolean;
  onPluginStart: boolean;
  onWake: boolean;
  offBeforeSleep: boolean;
  offBeforeShutdown: boolean;
}

export function canonicalPowerTarget(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 256) return;
  if (value.startsWith("group:"))
    return value.slice(6).trim() ? value : undefined;
  const parts = (value.startsWith("light:") ? value.slice(6) : value).split(
    "|",
  );
  if (parts.length !== 2 || parts.some((part) => !part.trim())) return;
  return `light:${parts[0]}|${parts[1]}`;
}

/** Only literal booleans grant consent; unknown/older settings stay disabled. */
export function normalizePowerRules(value: unknown): PowerLifecycleRule[] {
  if (!Array.isArray(value)) return [];
  const rules = new Map<string, PowerLifecycleRule>();
  for (const entry of value.slice(0, 100)) {
    if (!entry || typeof entry !== "object") continue;
    const id = canonicalPowerTarget(entry.selectedDeviceId);
    if (!id) continue;
    rules.set(id, {
      selectedDeviceId: id,
      enabled: entry.enabled === true,
      onPluginStart: entry.onPluginStart === true,
      onWake: entry.onWake === true,
      offBeforeSleep: entry.offBeforeSleep === true,
      offBeforeShutdown: entry.offBeforeShutdown === true,
    });
  }
  return [...rules.values()];
}
