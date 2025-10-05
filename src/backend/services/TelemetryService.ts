interface CommandStats {
  total: number;
  failures: number;
  totalDurationMs: number;
  lastError?: {
    name: string;
    message: string;
  };
}

interface TransportHealthSnapshot {
  checks: number;
  lastDurationMs?: number;
  lastSnapshot: Array<{
    kind: string;
    label: string;
    isHealthy: boolean;
    latencyMs?: number;
    lastChecked?: number;
  }>;
  lastFailure?: {
    name: string;
    message: string;
  };
}

interface DiscoveryStats {
  total: number;
  stale: number;
  totalDurationMs: number;
  lastDurationMs?: number;
  lastCount?: number;
}

interface CommandAggregate {
  total: number;
  failures: number;
  totalDurationMs: number;
  byCommand: Record<string, CommandStats>;
}

export interface TelemetrySnapshot {
  transport: TransportHealthSnapshot;
  discovery: DiscoveryStats;
  commands: CommandAggregate;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const EMPTY_SNAPSHOT: TelemetrySnapshot = {
  transport: {
    checks: 0,
    lastSnapshot: [],
  },
  discovery: {
    total: 0,
    stale: 0,
    totalDurationMs: 0,
  },
  commands: {
    total: 0,
    failures: 0,
    totalDurationMs: 0,
    byCommand: {},
  },
};

export class TelemetryService {
  private static instance: TelemetryService;
  private snapshot: TelemetrySnapshot = clone(EMPTY_SNAPSHOT);

  static getInstance(): TelemetryService {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }

  recordTransportHealth(
    data: Array<{
      kind: string;
      label: string;
      isHealthy: boolean;
      latencyMs?: number;
      lastChecked?: number;
    }>,
    durationMs: number,
    error?: { name: string; message: string },
  ): void {
    this.snapshot.transport.checks += 1;
    this.snapshot.transport.lastDurationMs = durationMs;
    this.snapshot.transport.lastSnapshot = data;
    if (error) {
      this.snapshot.transport.lastFailure = error;
    }
  }

  recordDiscovery({
    durationMs,
    count,
    stale,
  }: {
    durationMs: number;
    count: number;
    stale: boolean;
  }): void {
    this.snapshot.discovery.total += 1;
    if (stale) {
      this.snapshot.discovery.stale += 1;
    }
    this.snapshot.discovery.totalDurationMs += durationMs;
    this.snapshot.discovery.lastDurationMs = durationMs;
    this.snapshot.discovery.lastCount = count;
  }

  recordCommand({
    command,
    durationMs,
    success,
    error,
  }: {
    command: string;
    durationMs: number;
    success: boolean;
    error?: { name: string; message: string };
  }): void {
    this.snapshot.commands.total += 1;
    this.snapshot.commands.totalDurationMs += durationMs;

    if (!success) {
      this.snapshot.commands.failures += 1;
    }

    const key = command.toLowerCase();
    const entry = this.snapshot.commands.byCommand[key] ?? {
      total: 0,
      failures: 0,
      totalDurationMs: 0,
    };

    entry.total += 1;
    entry.totalDurationMs += durationMs;
    if (!success) {
      entry.failures += 1;
      if (error) {
        entry.lastError = error;
      }
    }

    this.snapshot.commands.byCommand[key] = entry;
  }

  getSnapshot(): TelemetrySnapshot {
    return clone(this.snapshot);
  }

  reset(): void {
    this.snapshot = clone(EMPTY_SNAPSHOT);
  }
}

export const telemetryService = TelemetryService.getInstance();
