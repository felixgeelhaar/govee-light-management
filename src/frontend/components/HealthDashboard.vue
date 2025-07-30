<template>
  <div class="health-dashboard">
    <div class="dashboard-header">
      <h3>System Health</h3>
      <div class="health-summary">
        <div :class="['health-status', healthStatus.overallStatus]">
          <div class="status-icon">
            <component :is="getStatusIcon(healthStatus.overallStatus)" />
          </div>
          <div class="status-info">
            <div class="status-label">{{ formatStatus(healthStatus.overallStatus) }}</div>
            <div class="health-score">{{ healthStatus.healthScore }}/100</div>
          </div>
        </div>
        <div class="health-controls">
          <button
            v-if="!healthStatus.isMonitoring"
            class="btn btn-primary"
            @click="startMonitoring"
          >
            Start Monitoring
          </button>
          <button
            v-else
            class="btn btn-secondary"
            @click="stopMonitoring"
          >
            Stop Monitoring
          </button>
          <button
            class="btn btn-secondary"
            @click="performHealthCheck"
            :disabled="isCheckingHealth"
          >
            {{ isCheckingHealth ? 'Checking...' : 'Check Now' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Health Trend -->
    <div v-if="healthHistory.length > 1" class="health-section">
      <h4>Health Trend</h4>
      <div class="trend-container">
        <svg class="trend-chart" viewBox="0 0 400 100">
          <polyline
            :points="generateTrendPoints()"
            fill="none"
            :stroke="getTrendColor()"
            stroke-width="2"
          />
          <circle
            v-for="(point, index) in getTrendPoints()"
            :key="index"
            :cx="point.x"
            :cy="point.y"
            r="2"
            :fill="getTrendColor()"
          />
        </svg>
        <div class="trend-info">
          <span :class="['trend-direction', healthStatus.trendDirection]">
            {{ formatTrendDirection(healthStatus.trendDirection) }}
          </span>
          <span class="trend-label">
            {{ healthHistory.length }} data points
          </span>
        </div>
      </div>
    </div>

    <!-- System Metrics -->
    <div class="health-section">
      <h4>System Metrics</h4>
      <div class="metrics-grid">
        <div
          v-for="(metric, key) in allMetrics"
          :key="key"
          :class="['metric-card', metric.status]"
        >
          <div class="metric-header">
            <span class="metric-name">{{ metric.name }}</span>
            <span :class="['metric-status', metric.status]">
              {{ formatStatus(metric.status) }}
            </span>
          </div>
          <div class="metric-value">
            {{ formatMetricValue(metric.value) }}
            <span v-if="metric.unit" class="metric-unit">{{ metric.unit }}</span>
          </div>
          <div v-if="metric.threshold" class="metric-thresholds">
            <div class="threshold-bar">
              <div
                class="threshold-fill"
                :style="{ width: getThresholdPercentage(metric) + '%' }"
              ></div>
            </div>
            <div class="threshold-labels">
              <span class="threshold-warning">{{ metric.threshold.warning }}{{ metric.unit || '' }}</span>
              <span class="threshold-critical">{{ metric.threshold.critical }}{{ metric.unit || '' }}</span>
            </div>
          </div>
          <div class="metric-updated">
            Last updated: {{ formatTime(metric.lastUpdated) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Diagnostics -->
    <div class="health-section">
      <h4>Recent Diagnostics</h4>
      <div class="diagnostics-container">
        <div class="diagnostics-filters">
          <button
            v-for="category in diagnosticCategories"
            :key="category"
            :class="['filter-btn', { active: selectedCategory === category }]"
            @click="selectedCategory = category"
          >
            {{ category }}
          </button>
        </div>
        
        <div class="diagnostics-list">
          <div
            v-for="diagnostic in filteredDiagnostics"
            :key="`${diagnostic.category}-${diagnostic.test}-${diagnostic.timestamp}`"
            :class="['diagnostic-item', diagnostic.result]"
          >
            <div class="diagnostic-header">
              <div class="diagnostic-info">
                <span class="diagnostic-category">{{ diagnostic.category }}</span>
                <span class="diagnostic-test">{{ diagnostic.test }}</span>
              </div>
              <div class="diagnostic-result">
                <span :class="['result-badge', diagnostic.result]">
                  {{ formatResult(diagnostic.result) }}
                </span>
                <span class="diagnostic-time">
                  {{ formatRelativeTime(diagnostic.timestamp) }}
                </span>
              </div>
            </div>
            <div class="diagnostic-message">{{ diagnostic.message }}</div>
            <div v-if="diagnostic.details" class="diagnostic-details">
              <details>
                <summary>Details</summary>
                <pre>{{ JSON.stringify(diagnostic.details, null, 2) }}</pre>
              </details>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- System Information -->
    <div class="health-section">
      <h4>System Information</h4>
      <div class="system-info">
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Platform:</span>
            <span class="info-value">{{ systemInfo.platform }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Language:</span>
            <span class="info-value">{{ systemInfo.language }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Online:</span>
            <span class="info-value">{{ systemInfo.onLine ? 'Yes' : 'No' }}</span>
          </div>
          <div v-if="systemInfo.memoryInfo" class="info-item">
            <span class="info-label">JS Memory:</span>
            <span class="info-value">
              {{ Math.round(systemInfo.memoryInfo.usedJSHeapSize / (1024 * 1024)) }}MB
            </span>
          </div>
          <div v-if="systemInfo.connection" class="info-item">
            <span class="info-label">Connection:</span>
            <span class="info-value">{{ systemInfo.connection.effectiveType }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Recommendations -->
    <div v-if="currentReport?.recommendations.length" class="health-section">
      <h4>Recommendations</h4>
      <div class="recommendations-list">
        <div
          v-for="(recommendation, index) in currentReport.recommendations"
          :key="index"
          class="recommendation-item"
        >
          <span class="recommendation-icon">💡</span>
          <span class="recommendation-text">{{ recommendation }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useHealthMonitoring, type HealthReport } from '../services/healthMonitoringService'
import { useFeedbackHelpers } from '../composables/useFeedback'

// Composables
const health = useHealthMonitoring()
const feedback = useFeedbackHelpers()

// Local state
const selectedCategory = ref('All')
const isCheckingHealth = ref(false)
const currentReport = ref<HealthReport | null>(null)

// Computed values
const healthStatus = computed(() => health.healthStatus.value)
const allMetrics = computed(() => health.getAllMetrics())
const recentDiagnostics = computed(() => health.getRecentDiagnostics(20))
const healthHistory = computed(() => health.getHealthHistory())
const systemInfo = computed(() => health.getSystemInfo())

const diagnosticCategories = computed(() => {
  const categories = new Set(['All'])
  recentDiagnostics.value.forEach(d => categories.add(d.category))
  return Array.from(categories)
})

const filteredDiagnostics = computed(() => {
  if (selectedCategory.value === 'All') {
    return recentDiagnostics.value
  }
  return recentDiagnostics.value.filter(d => d.category === selectedCategory.value)
})

// Methods
const startMonitoring = () => {
  health.startMonitoring()
  feedback.showSuccessToast('Health Monitoring Started', 'System health monitoring is now active')
}

const stopMonitoring = () => {
  health.stopMonitoring()
  feedback.showInfo('Health Monitoring Stopped', 'System health monitoring has been stopped')
}

const performHealthCheck = async () => {
  isCheckingHealth.value = true
  try {
    const report = await health.checkHealthNow()
    currentReport.value = report
    
    const statusMessage = `Health Score: ${report.score}/100`
    
    if (report.overall === 'healthy') {
      feedback.showSuccessToast('Health Check Complete', statusMessage)
    } else if (report.overall === 'degraded') {
      feedback.showWarning('Health Check Complete', statusMessage)
    } else {
      feedback.showError('Health Check Complete', statusMessage)
    }
  } catch (error) {
    feedback.showApiError(error, 'Health Check Failed')
  } finally {
    isCheckingHealth.value = false
  }
}

// Utility methods
const getStatusIcon = (status: string) => {
  switch (status) {
    case 'healthy': return '✅'
    case 'degraded': return '⚠️'
    case 'unhealthy': return '❌'
    default: return '❓'
  }
}

const formatStatus = (status: string): string => {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

const formatTrendDirection = (direction: string): string => {
  const icons = {
    improving: '📈 Improving',
    stable: '➡️ Stable',
    declining: '📉 Declining'
  }
  return icons[direction as keyof typeof icons] || direction
}

const formatResult = (result: string): string => {
  const resultMap = {
    pass: 'Pass',
    fail: 'Fail',
    warning: 'Warning'
  }
  return resultMap[result as keyof typeof resultMap] || result
}

const formatMetricValue = (value: number | string | boolean): string => {
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }
  if (typeof value === 'number') {
    return value.toLocaleString()
  }
  return String(value)
}

const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString()
}

const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now()
  const diff = now - timestamp
  
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

const getTrendPoints = (): Array<{ x: number; y: number }> => {
  const history = healthHistory.value
  if (history.length < 2) return []
  
  const points: Array<{ x: number; y: number }> = []
  const width = 400
  const height = 100
  const step = width / (history.length - 1)
  
  history.forEach((score, index) => {
    const x = index * step
    const y = height - (score / 100 * height)
    points.push({ x, y })
  })
  
  return points
}

const generateTrendPoints = (): string => {
  const points = getTrendPoints()
  return points.map(p => `${p.x},${p.y}`).join(' ')
}

const getTrendColor = (): string => {
  switch (healthStatus.value.trendDirection) {
    case 'improving': return '#28a745'
    case 'declining': return '#dc3545'
    case 'stable': 
    default: return '#0099ff'
  }
}

const getThresholdPercentage = (metric: any): number => {
  if (!metric.threshold || typeof metric.value !== 'number') return 0
  
  const value = metric.value as number
  const max = metric.threshold.critical * 1.2 // Show some buffer beyond critical
  
  return Math.min(100, (value / max) * 100)
}

// Lifecycle
onMounted(() => {
  // Start monitoring if not already running
  if (!healthStatus.value.isMonitoring) {
    health.startMonitoring()
  }
  
  // Perform initial health check
  performHealthCheck()
})

onUnmounted(() => {
  // Keep monitoring running when component unmounts
  // User can manually stop it if needed
})
</script>

<style scoped>
.health-dashboard {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 16px;
}

.dashboard-header {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--sdpi-color-border, #333);
}

.dashboard-header h3 {
  margin: 0;
  color: var(--sdpi-color-accent, #0099ff);
}

.health-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.health-status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  border-left: 4px solid;
}

.health-status.healthy {
  background: var(--sdpi-color-bg-success, #1a3b1a);
  border-left-color: #28a745;
}

.health-status.degraded {
  background: var(--sdpi-color-bg-warning, #3b3b1a);
  border-left-color: #ffc107;
}

.health-status.unhealthy {
  background: var(--sdpi-color-bg-error, #3b1a1a);
  border-left-color: #dc3545;
}

.status-icon {
  font-size: 24px;
}

.status-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.status-label {
  font-weight: 600;
  font-size: 16px;
  color: var(--sdpi-color-text, #cccccc);
}

.health-score {
  font-size: 14px;
  color: var(--sdpi-color-text-secondary, #999);
}

.health-controls {
  display: flex;
  gap: 8px;
}

.health-section {
  background: var(--sdpi-color-bg-secondary, #2d2d30);
  border: 1px solid var(--sdpi-color-border, #333);
  border-radius: 8px;
  padding: 16px;
}

.health-section h4 {
  margin: 0 0 16px 0;
  color: var(--sdpi-color-text, #cccccc);
  font-size: 14px;
  font-weight: 600;
}

.trend-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.trend-chart {
  width: 100%;
  height: 100px;
  background: var(--sdpi-color-bg, #1e1e1e);
  border: 1px solid var(--sdpi-color-border, #333);
  border-radius: 4px;
}

.trend-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
}

.trend-direction {
  font-weight: 500;
}

.trend-direction.improving {
  color: #28a745;
}

.trend-direction.declining {
  color: #dc3545;
}

.trend-direction.stable {
  color: var(--sdpi-color-accent, #0099ff);
}

.trend-label {
  color: var(--sdpi-color-text-secondary, #999);
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}

.metric-card {
  background: var(--sdpi-color-bg, #1e1e1e);
  border: 1px solid var(--sdpi-color-border, #333);
  border-radius: 6px;
  padding: 12px;
  position: relative;
}

.metric-card.healthy {
  border-left: 3px solid #28a745;
}

.metric-card.warning {
  border-left: 3px solid #ffc107;
}

.metric-card.critical {
  border-left: 3px solid #dc3545;
}

.metric-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.metric-name {
  font-weight: 500;
  font-size: 14px;
  color: var(--sdpi-color-text, #cccccc);
}

.metric-status {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  text-transform: uppercase;
  font-weight: 600;
}

.metric-status.healthy {
  background: #28a745;
  color: white;
}

.metric-status.warning {  
  background: #ffc107;
  color: #333;
}

.metric-status.critical {
  background: #dc3545;
  color: white;
}

.metric-value {
  font-size: 18px;
  font-weight: bold;
  color: var(--sdpi-color-accent, #0099ff);
  margin-bottom: 8px;
}

.metric-unit {
  font-size: 12px;
  font-weight: normal;
  color: var(--sdpi-color-text-secondary, #999);
  margin-left: 4px;
}

.metric-thresholds {
  margin-bottom: 8px;
}

.threshold-bar {
  height: 4px;
  background: var(--sdpi-color-border, #333);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 4px;
}

.threshold-fill {
  height: 100%;
  background: linear-gradient(90deg, #28a745 0%, #ffc107 50%, #dc3545 100%);
  transition: width 0.3s ease;
}

.threshold-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--sdpi-color-text-secondary, #999);
}

.threshold-warning {
  color: #ffc107;
}

.threshold-critical {
  color: #dc3545;
}

.metric-updated {
  font-size: 10px;
  color: var(--sdpi-color-text-secondary, #999);
}

.diagnostics-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.diagnostics-filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-btn {
  padding: 4px 8px;
  border: 1px solid var(--sdpi-color-border, #333);
  border-radius: 4px;
  background: var(--sdpi-color-bg, #1e1e1e);
  color: var(--sdpi-color-text, #cccccc);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.filter-btn:hover {
  background: var(--sdpi-color-bg-hover, #505050);
}

.filter-btn.active {
  background: var(--sdpi-color-accent, #0099ff);
  color: white;
  border-color: var(--sdpi-color-accent, #0099ff);
}

.diagnostics-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.diagnostic-item {
  padding: 12px;
  background: var(--sdpi-color-bg, #1e1e1e);
  border: 1px solid var(--sdpi-color-border, #333);
  border-radius: 6px;
  border-left: 3px solid;
}

.diagnostic-item.pass {
  border-left-color: #28a745;
}

.diagnostic-item.warning {
  border-left-color: #ffc107;
}

.diagnostic-item.fail {
  border-left-color: #dc3545;
}

.diagnostic-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.diagnostic-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.diagnostic-category {
  font-size: 10px;
  color: var(--sdpi-color-text-secondary, #999);
  text-transform: uppercase;
}

.diagnostic-test {
  font-size: 12px;
  font-weight: 500;
  color: var(--sdpi-color-text, #cccccc);
}

.diagnostic-result {
  display: flex;
  align-items: center;
  gap: 8px;
}

.result-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  text-transform: uppercase;
  font-weight: 600;
}

.result-badge.pass {
  background: #28a745;
  color: white;
}

.result-badge.warning {
  background: #ffc107;
  color: #333;
}

.result-badge.fail {
  background: #dc3545;
  color: white;
}

.diagnostic-time {
  font-size: 10px;
  color: var(--sdpi-color-text-secondary, #999);
}

.diagnostic-message {
  font-size: 12px;
  color: var(--sdpi-color-text, #cccccc);
  margin-bottom: 8px;
}

.diagnostic-details details {
  font-size: 10px;
}

.diagnostic-details summary {
  cursor: pointer;
  color: var(--sdpi-color-accent, #0099ff);
  font-size: 10px;
}

.diagnostic-details pre {
  margin: 4px 0;
  padding: 8px;
  background: var(--sdpi-color-bg-secondary, #2d2d30);
  border-radius: 4px;
  font-size: 10px;
  overflow-x: auto;
}

.system-info {
  font-size: 12px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.info-item {
  display: flex;
  justify-content: space-between;
}

.info-label {
  color: var(--sdpi-color-text-secondary, #999);
}

.info-value {
  color: var(--sdpi-color-text, #cccccc);
  font-weight: 500;
}

.recommendations-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.recommendation-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px;
  background: var(--sdpi-color-bg, #1e1e1e);
  border-radius: 4px;
  border: 1px solid var(--sdpi-color-border, #333);
}

.recommendation-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.recommendation-text {
  font-size: 12px;
  color: var(--sdpi-color-text, #cccccc);
  line-height: 1.4;
}

/* Button styles */
.btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background-color: var(--sdpi-color-accent, #0099ff);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--sdpi-color-accent-hover, #0077cc);
}

.btn-secondary {
  background-color: var(--sdpi-color-bg-tertiary, #404040);
  color: var(--sdpi-color-text, #cccccc);
  border: 1px solid var(--sdpi-color-border, #333);
}

.btn-secondary:hover:not(:disabled) {
  background-color: var(--sdpi-color-bg-hover, #505050);
}
</style>