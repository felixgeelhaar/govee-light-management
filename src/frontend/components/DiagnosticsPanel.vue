<template>
  <div v-if="hasData" class="diagnostics">
    <div class="diagnostics-header">
      <h3>Diagnostics</h3>
      <div class="diagnostics-actions">
        <button class="btn btn-secondary btn-small" @click="$emit('refresh')">
          🔄 Refresh
        </button>
        <button class="btn btn-secondary btn-small" @click="$emit('reset')">
          ♻️ Reset
        </button>
      </div>
    </div>

    <div class="diagnostics-grid">
      <div class="diagnostic-card">
        <span class="diagnostic-label">Discovery Avg</span>
        <strong>{{ averageDiscovery !== null ? `${averageDiscovery} ms` : '–' }}</strong>
        <small>{{ snapshot?.discovery.total }} scans</small>
      </div>
      <div class="diagnostic-card">
        <span class="diagnostic-label">Stale Responses</span>
        <strong>{{ snapshot?.discovery.stale }}</strong>
        <small>Total {{ snapshot?.discovery.total }}</small>
      </div>
      <div class="diagnostic-card">
        <span class="diagnostic-label">Command Success</span>
        <strong>{{ commandSuccess !== null ? `${commandSuccess}%` : '–' }}</strong>
        <small>
          {{ totalCommands - failedCommands }} / {{ totalCommands }}
        </small>
      </div>
      <div class="diagnostic-card">
        <span class="diagnostic-label">Transport Checks</span>
        <strong>{{ snapshot?.transport.checks }}</strong>
        <small>
          Last {{ snapshot?.transport.lastDurationMs ? `${snapshot?.transport.lastDurationMs} ms` : '–' }}
        </small>
      </div>
    </div>

    <div class="diagnostics-subsection" v-if="snapshot?.transport.lastFailure">
      <span class="diagnostic-label">Last Transport Error</span>
      <small>
        {{ snapshot.transport.lastFailure?.name }}:
        {{ snapshot.transport.lastFailure?.message }}
      </small>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface TelemetrySnapshot {
  transport: {
    checks: number
    lastDurationMs?: number
    lastSnapshot: Array<{
      kind: string
      label: string
      isHealthy: boolean
      latencyMs?: number
      lastChecked?: number
    }>
    lastFailure?: {
      name: string
      message: string
    }
  }
  discovery: {
    total: number
    stale: number
    totalDurationMs: number
    lastDurationMs?: number
    lastCount?: number
  }
  commands: {
    total: number
    failures: number
    totalDurationMs: number
    byCommand: Record<string, {
      total: number
      failures: number
      totalDurationMs: number
      lastError?: { name: string; message: string }
    }>
  }
}

const props = defineProps<{
  snapshot: TelemetrySnapshot | null
}>()

defineEmits<{
  refresh: []
  reset: []
}>()

const hasData = computed(() => Boolean(props.snapshot))

const averageDiscovery = computed(() => {
  if (!props.snapshot || props.snapshot.discovery.total === 0) return null
  return Math.round(props.snapshot.discovery.totalDurationMs / props.snapshot.discovery.total)
})

const commandSuccess = computed(() => {
  if (!props.snapshot || props.snapshot.commands.total === 0) return null
  const success = props.snapshot.commands.total - props.snapshot.commands.failures
  return Math.round((success / props.snapshot.commands.total) * 100)
})

const totalCommands = computed(() => props.snapshot?.commands.total ?? 0)
const failedCommands = computed(() => props.snapshot?.commands.failures ?? 0)
</script>

<style scoped>
.diagnostics {
  margin-top: 16px;
  padding: 12px;
  background: var(--elgato-bg-subsection, #232427);
  border: 1px solid var(--elgato-border);
  border-radius: 6px;
  display: grid;
  gap: 12px;
}

.diagnostics-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.diagnostics-actions {
  display: flex;
  gap: 6px;
}

.diagnostics-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.diagnostic-card {
  background: var(--elgato-bg-section);
  border: 1px solid var(--elgato-border);
  border-radius: 4px;
  padding: 10px;
  display: grid;
  gap: 4px;
}

.diagnostic-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--elgato-text-tertiary);
}

.diagnostics-subsection {
  border-top: 1px solid var(--elgato-border);
  padding-top: 8px;
  font-size: 12px;
  color: var(--elgato-text-secondary);
}
</style>
