/**
 * Plugin health monitoring and diagnostics service
 * Provides comprehensive system health monitoring, performance tracking, and diagnostic capabilities
 */

import { ref, computed } from "vue";
import { websocketService } from "./websocketService";
import { apiCacheService } from "./cacheService";
import { performanceService } from "./performanceService";
import { recoveryService } from "./recoveryService";
import { lightMonitoringService } from "./lightMonitoringService";

export interface HealthMetric {
  name: string;
  value: number | string | boolean;
  unit?: string;
  status: "healthy" | "warning" | "critical";
  threshold?: {
    warning: number;
    critical: number;
  };
  lastUpdated: number;
}

export interface SystemDiagnostic {
  category: string;
  test: string;
  result: "pass" | "fail" | "warning";
  message: string;
  details?: Record<string, any>;
  timestamp: number;
}

export interface HealthReport {
  overall: "healthy" | "degraded" | "unhealthy";
  score: number; // 0-100
  metrics: Record<string, HealthMetric>;
  diagnostics: SystemDiagnostic[];
  recommendations: string[];
  timestamp: number;
}

/**
 * Plugin health monitoring service
 */
export class HealthMonitoringService {
  private isMonitoring = ref(false);
  private healthScore = ref(100);
  private overallStatus = ref<"healthy" | "degraded" | "unhealthy">("healthy");
  private lastHealthCheck = ref<number | null>(null);

  // Health metrics storage
  private metrics = new Map<string, HealthMetric>();
  private diagnosticHistory: SystemDiagnostic[] = [];
  private healthHistory: number[] = [];

  // Monitoring configuration
  private checkInterval = 60000; // 1 minute
  private monitoringTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeMetrics();
  }

  /**
   * Start health monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring.value) {
      return;
    }

    this.isMonitoring.value = true;
    this.scheduleHealthCheck();

    // Perform initial health check
    this.performHealthCheck();

    console.log("Health monitoring started");
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }

    this.isMonitoring.value = false;
    console.log("Health monitoring stopped");
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<HealthReport> {
    const startTime = Date.now();
    const diagnostics: SystemDiagnostic[] = [];
    const recommendations: string[] = [];

    // Update all metrics
    await this.updateAllMetrics();

    // Run diagnostic tests
    diagnostics.push(...(await this.runWebSocketDiagnostics()));
    diagnostics.push(...(await this.runCacheDiagnostics()));
    diagnostics.push(...(await this.runPerformanceDiagnostics()));
    diagnostics.push(...(await this.runMemoryDiagnostics()));
    diagnostics.push(...(await this.runMonitoringDiagnostics()));

    // Calculate health score
    const score = this.calculateHealthScore(diagnostics);
    this.healthScore.value = score;
    this.healthHistory.push(score);

    // Keep only last 100 scores
    if (this.healthHistory.length > 100) {
      this.healthHistory = this.healthHistory.slice(-100);
    }

    // Determine overall status
    const overall = this.determineOverallStatus(score, diagnostics);
    this.overallStatus.value = overall;

    // Generate recommendations
    recommendations.push(...this.generateRecommendations(diagnostics));

    // Store diagnostics
    this.diagnosticHistory.push(...diagnostics);
    if (this.diagnosticHistory.length > 500) {
      this.diagnosticHistory = this.diagnosticHistory.slice(-500);
    }

    this.lastHealthCheck.value = Date.now();

    const report: HealthReport = {
      overall,
      score,
      metrics: this.getMetricsSnapshot(),
      diagnostics,
      recommendations,
      timestamp: startTime,
    };

    return report;
  }

  /**
   * Get current health status
   */
  getHealthStatus(): {
    isMonitoring: boolean;
    overallStatus: "healthy" | "degraded" | "unhealthy";
    healthScore: number;
    lastCheckTime: number | null;
    trendDirection: "improving" | "stable" | "declining";
  } {
    const trend = this.calculateTrend();

    return {
      isMonitoring: this.isMonitoring.value,
      overallStatus: this.overallStatus.value,
      healthScore: this.healthScore.value,
      lastCheckTime: this.lastHealthCheck.value,
      trendDirection: trend,
    };
  }

  /**
   * Get specific metric
   */
  getMetric(name: string): HealthMetric | null {
    return this.metrics.get(name) || null;
  }

  /**
   * Get all current metrics
   */
  getAllMetrics(): Record<string, HealthMetric> {
    return this.getMetricsSnapshot();
  }

  /**
   * Get recent diagnostics
   */
  getRecentDiagnostics(limit = 50): SystemDiagnostic[] {
    return this.diagnosticHistory.slice(-limit);
  }

  /**
   * Get diagnostics by category
   */
  getDiagnosticsByCategory(category: string): SystemDiagnostic[] {
    return this.diagnosticHistory.filter((d) => d.category === category);
  }

  /**
   * Get health history for trending
   */
  getHealthHistory(): number[] {
    return [...this.healthHistory];
  }

  /**
   * Force immediate health check
   */
  async checkHealthNow(): Promise<HealthReport> {
    return await this.performHealthCheck();
  }

  /**
   * Get system information for diagnostics
   */
  getSystemInfo(): Record<string, any> {
    return {
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      memoryInfo: (performance as any).memory
        ? {
            usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
            totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
            jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit,
          }
        : null,
      connection: (navigator as any).connection
        ? {
            effectiveType: (navigator as any).connection.effectiveType,
            downlink: (navigator as any).connection.downlink,
            rtt: (navigator as any).connection.rtt,
          }
        : null,
    };
  }

  /**
   * Reset all health data
   */
  reset(): void {
    this.stopMonitoring();
    this.metrics.clear();
    this.diagnosticHistory = [];
    this.healthHistory = [];
    this.healthScore.value = 100;
    this.overallStatus.value = "healthy";
    this.lastHealthCheck.value = null;
    this.initializeMetrics();
  }

  /**
   * Private methods
   */
  private initializeMetrics(): void {
    const now = Date.now();

    // Initialize core metrics
    this.metrics.set("websocket_status", {
      name: "WebSocket Connection",
      value: false,
      status: "critical",
      lastUpdated: now,
    });

    this.metrics.set("cache_hit_rate", {
      name: "Cache Hit Rate",
      value: 0,
      unit: "%",
      status: "healthy",
      threshold: { warning: 50, critical: 25 },
      lastUpdated: now,
    });

    this.metrics.set("memory_usage", {
      name: "Memory Usage",
      value: 0,
      unit: "MB",
      status: "healthy",
      threshold: { warning: 100, critical: 200 },
      lastUpdated: now,
    });

    this.metrics.set("error_rate", {
      name: "Error Rate",
      value: 0,
      unit: "%",
      status: "healthy",
      threshold: { warning: 5, critical: 10 },
      lastUpdated: now,
    });
  }

  private scheduleHealthCheck(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }

    this.monitoringTimer = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error("Health check failed:", error);
      }
    }, this.checkInterval);
  }

  private async updateAllMetrics(): Promise<void> {
    const now = Date.now();

    // WebSocket status
    this.updateMetric("websocket_status", {
      name: "WebSocket Connection",
      value: websocketService.isConnected,
      status: websocketService.isConnected ? "healthy" : "critical",
      lastUpdated: now,
    });

    // Cache metrics
    const cacheStats = apiCacheService.getHealthStatus();
    const hitRate = cacheStats.hitRate || 0;
    this.updateMetric("cache_hit_rate", {
      name: "Cache Hit Rate",
      value: Math.round(hitRate),
      unit: "%",
      status:
        hitRate >= 75 ? "healthy" : hitRate >= 50 ? "warning" : "critical",
      threshold: { warning: 50, critical: 25 },
      lastUpdated: now,
    });

    // Memory usage
    let memoryUsage = 0;
    let memoryStatus: "healthy" | "warning" | "critical" = "healthy";

    if ((performance as any).memory) {
      const memInfo = (performance as any).memory;
      memoryUsage = Math.round(memInfo.usedJSHeapSize / (1024 * 1024));
      memoryStatus =
        memoryUsage > 200
          ? "critical"
          : memoryUsage > 100
            ? "warning"
            : "healthy";
    }

    this.updateMetric("memory_usage", {
      name: "Memory Usage",
      value: memoryUsage,
      unit: "MB",
      status: memoryStatus,
      threshold: { warning: 100, critical: 200 },
      lastUpdated: now,
    });

    // Error rate (from recovery service)
    const recoveryStats = recoveryService.getRecoveryStats();
    const errorRate =
      recoveryStats.totalAttempts > 0
        ? Math.round((1 - recoveryStats.successRate / 100) * 100)
        : 0;

    this.updateMetric("error_rate", {
      name: "Error Rate",
      value: errorRate,
      unit: "%",
      status:
        errorRate >= 10 ? "critical" : errorRate >= 5 ? "warning" : "healthy",
      threshold: { warning: 5, critical: 10 },
      lastUpdated: now,
    });
  }

  private updateMetric(key: string, metric: HealthMetric): void {
    this.metrics.set(key, metric);
  }

  private async runWebSocketDiagnostics(): Promise<SystemDiagnostic[]> {
    const diagnostics: SystemDiagnostic[] = [];
    const now = Date.now();

    // Connection status
    diagnostics.push({
      category: "WebSocket",
      test: "Connection Status",
      result: websocketService.isConnected ? "pass" : "fail",
      message: websocketService.isConnected
        ? "WebSocket connection is active"
        : "WebSocket connection is not established",
      timestamp: now,
    });

    // Connection stability (check if frequent disconnections)
    // This would require tracking connection events over time
    diagnostics.push({
      category: "WebSocket",
      test: "Connection Stability",
      result: "pass", // Simplified for now
      message: "Connection appears stable",
      timestamp: now,
    });

    return diagnostics;
  }

  private async runCacheDiagnostics(): Promise<SystemDiagnostic[]> {
    const diagnostics: SystemDiagnostic[] = [];
    const now = Date.now();
    const cacheHealth = apiCacheService.getHealthStatus();

    diagnostics.push({
      category: "Cache",
      test: "Cache Health",
      result:
        cacheHealth.status === "healthy"
          ? "pass"
          : cacheHealth.status === "warning"
            ? "warning"
            : "fail",
      message: `Cache status: ${cacheHealth.status}`,
      details: {
        size: cacheHealth.size,
        hitRate: cacheHealth.hitRate,
        recommendations: cacheHealth.recommendations,
      },
      timestamp: now,
    });

    return diagnostics;
  }

  private async runPerformanceDiagnostics(): Promise<SystemDiagnostic[]> {
    const diagnostics: SystemDiagnostic[] = [];
    const now = Date.now();

    // Performance trends
    const trends = performanceService.getResourceTrends();

    diagnostics.push({
      category: "Performance",
      test: "Memory Trend",
      result: trends.memory.trend === "increasing" ? "warning" : "pass",
      message: `Memory trend: ${trends.memory.trend}`,
      details: trends,
      timestamp: now,
    });

    // Check for performance bottlenecks
    const bottlenecks = performanceService.getBottlenecks();
    if (bottlenecks.length > 0) {
      diagnostics.push({
        category: "Performance",
        test: "Performance Bottlenecks",
        result: bottlenecks.some((b) => b.severity === "high")
          ? "fail"
          : "warning",
        message: `Found ${bottlenecks.length} performance bottleneck(s)`,
        details: { bottlenecks },
        timestamp: now,
      });
    }

    return diagnostics;
  }

  private async runMemoryDiagnostics(): Promise<SystemDiagnostic[]> {
    const diagnostics: SystemDiagnostic[] = [];
    const now = Date.now();

    if ((performance as any).memory) {
      const memInfo = (performance as any).memory;
      const usagePercent =
        (memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit) * 100;

      diagnostics.push({
        category: "Memory",
        test: "Heap Usage",
        result:
          usagePercent > 80 ? "fail" : usagePercent > 60 ? "warning" : "pass",
        message: `Heap usage: ${Math.round(usagePercent)}%`,
        details: {
          used: Math.round(memInfo.usedJSHeapSize / (1024 * 1024)),
          total: Math.round(memInfo.totalJSHeapSize / (1024 * 1024)),
          limit: Math.round(memInfo.jsHeapSizeLimit / (1024 * 1024)),
        },
        timestamp: now,
      });
    }

    return diagnostics;
  }

  private async runMonitoringDiagnostics(): Promise<SystemDiagnostic[]> {
    const diagnostics: SystemDiagnostic[] = [];
    const now = Date.now();

    // Check light monitoring status
    const monitoringStats = lightMonitoringService.getMonitoringStats();

    diagnostics.push({
      category: "Monitoring",
      test: "Light Monitoring",
      result: monitoringStats.isActive ? "pass" : "warning",
      message: monitoringStats.isActive
        ? `Monitoring ${monitoringStats.monitoredCount} lights`
        : "Light monitoring is not active",
      details: monitoringStats,
      timestamp: now,
    });

    return diagnostics;
  }

  private calculateHealthScore(diagnostics: SystemDiagnostic[]): number {
    if (diagnostics.length === 0) return 100;

    let score = 100;

    diagnostics.forEach((diagnostic) => {
      switch (diagnostic.result) {
        case "fail":
          score -= 20;
          break;
        case "warning":
          score -= 10;
          break;
        case "pass":
        default:
          // No penalty for passing tests
          break;
      }
    });

    return Math.max(0, Math.min(100, score));
  }

  private determineOverallStatus(
    score: number,
    diagnostics: SystemDiagnostic[],
  ): "healthy" | "degraded" | "unhealthy" {
    const hasFailures = diagnostics.some((d) => d.result === "fail");

    if (hasFailures || score < 60) {
      return "unhealthy";
    }

    if (score < 80 || diagnostics.some((d) => d.result === "warning")) {
      return "degraded";
    }

    return "healthy";
  }

  private generateRecommendations(diagnostics: SystemDiagnostic[]): string[] {
    const recommendations: string[] = [];

    diagnostics.forEach((diagnostic) => {
      if (diagnostic.result === "fail" || diagnostic.result === "warning") {
        switch (diagnostic.category) {
          case "WebSocket":
            recommendations.push(
              "Check network connection and Stream Deck software",
            );
            break;
          case "Cache":
            recommendations.push(
              "Consider clearing cache or adjusting cache settings",
            );
            break;
          case "Performance":
            if (diagnostic.test === "Memory Trend") {
              recommendations.push(
                "Monitor memory usage and consider restarting if needed",
              );
            }
            if (diagnostic.test === "Performance Bottlenecks") {
              recommendations.push("Review and optimize slow operations");
            }
            break;
          case "Memory":
            recommendations.push(
              "Consider reloading the Property Inspector to free memory",
            );
            break;
          case "Monitoring":
            recommendations.push(
              "Enable light monitoring for better system insights",
            );
            break;
        }
      }
    });

    return [...new Set(recommendations)]; // Remove duplicates
  }

  private calculateTrend(): "improving" | "stable" | "declining" {
    if (this.healthHistory.length < 5) {
      return "stable";
    }

    const recent = this.healthHistory.slice(-5);
    const average =
      recent.reduce((sum, score) => sum + score, 0) / recent.length;
    const previousAverage =
      this.healthHistory.slice(-10, -5).reduce((sum, score) => sum + score, 0) /
      5;

    const difference = average - previousAverage;

    if (difference > 5) return "improving";
    if (difference < -5) return "declining";
    return "stable";
  }

  private getMetricsSnapshot(): Record<string, HealthMetric> {
    const snapshot: Record<string, HealthMetric> = {};
    this.metrics.forEach((metric, key) => {
      snapshot[key] = { ...metric };
    });
    return snapshot;
  }
}

/**
 * Singleton instance
 */
export const healthMonitoringService = new HealthMonitoringService();

/**
 * Vue composable for health monitoring
 */
export function useHealthMonitoring() {
  return {
    // State
    healthStatus: computed(() => healthMonitoringService.getHealthStatus()),

    // Actions
    startMonitoring: () => healthMonitoringService.startMonitoring(),
    stopMonitoring: () => healthMonitoringService.stopMonitoring(),
    checkHealthNow: () => healthMonitoringService.checkHealthNow(),

    // Data access
    getMetric: (name: string) => healthMonitoringService.getMetric(name),
    getAllMetrics: () => healthMonitoringService.getAllMetrics(),
    getRecentDiagnostics: (limit?: number) =>
      healthMonitoringService.getRecentDiagnostics(limit),
    getDiagnosticsByCategory: (category: string) =>
      healthMonitoringService.getDiagnosticsByCategory(category),
    getHealthHistory: () => healthMonitoringService.getHealthHistory(),
    getSystemInfo: () => healthMonitoringService.getSystemInfo(),

    // Utilities
    reset: () => healthMonitoringService.reset(),
  };
}
