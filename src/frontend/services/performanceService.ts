/**
 * Performance monitoring and optimization service
 * Tracks performance metrics, identifies bottlenecks, and provides optimization insights
 */

export interface PerformanceMetric {
  name: string
  startTime: number
  endTime?: number
  duration?: number
  tags?: Record<string, string>
  metadata?: Record<string, any>
}

export interface PerformanceReport {
  metrics: PerformanceMetric[]
  summary: {
    totalOperations: number
    averageTime: number
    slowestOperation: PerformanceMetric | null
    fastestOperation: PerformanceMetric | null
    operationsByType: Record<string, number>
  }
  recommendations: string[]
}

export interface PerformanceBottleneck {
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  impact: string
  recommendation: string
  metrics: PerformanceMetric[]
}

export interface TrendAnalysis {
  trend: 'increasing' | 'decreasing' | 'stable'
  rate?: number
  confidence: number
  recommendation?: string
}

export interface ResourceUsage {
  memoryUsage: number
  cacheHitRate: number
  networkRequests: number
  errorRate: number
  timestamp: number
}

/**
 * Advanced performance monitoring service
 */
export class PerformanceService {
  private metrics: PerformanceMetric[] = []
  private activeOperations = new Map<string, PerformanceMetric>()
  private resourceHistory: ResourceUsage[] = []
  private maxMetrics = 1000 // Keep last 1000 metrics
  private maxHistory = 100 // Keep last 100 resource snapshots

  // Performance thresholds (in milliseconds)
  private thresholds = {
    apiCall: 5000, // 5 seconds
    uiOperation: 100, // 100ms
    cacheOperation: 10, // 10ms
    websocketMessage: 1000 // 1 second
  }

  /**
   * Start timing an operation
   */
  startTimer(operationId: string, name: string, tags?: Record<string, string>): void {
    const metric: PerformanceMetric = {
      name,
      startTime: performance.now(),
      tags: tags || {},
      metadata: {}
    }

    this.activeOperations.set(operationId, metric)
  }

  /**
   * End timing an operation
   */
  endTimer(operationId: string, metadata?: Record<string, any>): void {
    const metric = this.activeOperations.get(operationId)
    if (!metric) {
      console.warn(`Performance timer not found: ${operationId}`)
      return
    }

    metric.endTime = performance.now()
    metric.duration = metric.endTime - metric.startTime
    metric.metadata = { ...metric.metadata, ...metadata }

    // Move to completed metrics
    this.activeOperations.delete(operationId)
    this.addMetric(metric)

    // Check for performance issues
    this.checkPerformanceThresholds(metric)
  }

  /**
   * Record a one-shot performance measurement
   */
  recordMetric(name: string, duration: number, tags?: Record<string, string>, metadata?: Record<string, any>): void {
    const metric: PerformanceMetric = {
      name,
      startTime: performance.now() - duration,
      endTime: performance.now(),
      duration,
      tags: tags || {},
      metadata: metadata || {}
    }

    this.addMetric(metric)
    this.checkPerformanceThresholds(metric)
  }

  /**
   * Time an async operation
   */
  async timeAsync<T>(
    operationId: string, 
    name: string, 
    operation: () => Promise<T>,
    tags?: Record<string, string>
  ): Promise<T> {
    this.startTimer(operationId, name, tags)
    
    try {
      const result = await operation()
      this.endTimer(operationId, { success: true })
      return result
    } catch (error) {
      this.endTimer(operationId, { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
      throw error
    }
  }

  /**
   * Time a synchronous operation
   */
  timeSync<T>(
    operationId: string,
    name: string,
    operation: () => T,
    tags?: Record<string, string>
  ): T {
    this.startTimer(operationId, name, tags)
    
    try {
      const result = operation()
      this.endTimer(operationId, { success: true })
      return result
    } catch (error) {
      this.endTimer(operationId, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Record current resource usage
   */
  recordResourceUsage(additionalData?: Partial<ResourceUsage>): void {
    const usage: ResourceUsage = {
      memoryUsage: this.getMemoryUsage(),
      cacheHitRate: 0, // Will be updated by cache service
      networkRequests: 0, // Will be updated by network interceptors
      errorRate: this.calculateErrorRate(),
      timestamp: Date.now(),
      ...additionalData
    }

    this.resourceHistory.push(usage)
    
    // Trim history if too long
    if (this.resourceHistory.length > this.maxHistory) {
      this.resourceHistory = this.resourceHistory.slice(-this.maxHistory)
    }
  }

  /**
   * Generate performance report
   */
  generateReport(timeRange?: { start: number; end: number }): PerformanceReport {
    let metricsToAnalyze = this.metrics

    // Filter by time range if provided
    if (timeRange) {
      metricsToAnalyze = this.metrics.filter(m => 
        m.startTime >= timeRange.start && m.startTime <= timeRange.end
      )
    }

    const completedMetrics = metricsToAnalyze.filter(m => m.duration !== undefined)
    
    if (completedMetrics.length === 0) {
      return {
        metrics: [],
        summary: {
          totalOperations: 0,
          averageTime: 0,
          slowestOperation: null,
          fastestOperation: null,
          operationsByType: {}
        },
        recommendations: ['No performance data available']
      }
    }

    // Calculate summary statistics
    const durations = completedMetrics.map(m => m.duration!)
    const totalOperations = completedMetrics.length
    const averageTime = durations.reduce((sum, d) => sum + d, 0) / durations.length
    
    const slowestOperation = completedMetrics.reduce((prev, current) => 
      (current.duration! > prev.duration!) ? current : prev
    )
    
    const fastestOperation = completedMetrics.reduce((prev, current) =>
      (current.duration! < prev.duration!) ? current : prev
    )

    // Group operations by type/name
    const operationsByType: Record<string, number> = {}
    completedMetrics.forEach(metric => {
      operationsByType[metric.name] = (operationsByType[metric.name] || 0) + 1
    })

    // Generate recommendations
    const recommendations = this.generateRecommendations(completedMetrics)

    return {
      metrics: completedMetrics,
      summary: {
        totalOperations,
        averageTime: Number(averageTime.toFixed(2)),
        slowestOperation,
        fastestOperation,
        operationsByType
      },
      recommendations
    }
  }

  /**
   * Get performance insights and bottlenecks
   */
  getBottlenecks(): PerformanceBottleneck[] {
    const bottlenecks: PerformanceBottleneck[] = []

    // Group metrics by operation name
    const operationGroups = new Map<string, PerformanceMetric[]>()
    
    this.metrics.forEach(metric => {
      if (metric.duration !== undefined) {
        if (!operationGroups.has(metric.name)) {
          operationGroups.set(metric.name, [])
        }
        operationGroups.get(metric.name)!.push(metric)
      }
    })

    // Analyze each operation group
    operationGroups.forEach((metrics, operationName) => {
      const durations = metrics.map(m => m.duration!)
      const averageTime = durations.reduce((sum, d) => sum + d, 0) / durations.length
      const count = metrics.length

      // Determine severity and recommendation
      let severity: 'low' | 'medium' | 'high' = 'low'
      let recommendation = ''

      const threshold = this.getThresholdForOperation(operationName)
      
      if (averageTime > threshold * 2) {
        severity = 'high'
        recommendation = `${operationName} is very slow (${averageTime.toFixed(2)}ms avg). Consider optimization.`
      } else if (averageTime > threshold) {
        severity = 'medium'
        recommendation = `${operationName} is slower than expected (${averageTime.toFixed(2)}ms avg).`
      } else if (averageTime > threshold * 0.5) {
        severity = 'low'
        recommendation = `${operationName} performance is acceptable but could be improved.`
      }

      if (severity !== 'low') {
        bottlenecks.push({
          type: 'performance',
          severity: severity as 'low' | 'medium' | 'high' | 'critical',
          description: `${operationName} performance bottleneck`,
          impact: `Average response time: ${averageTime.toFixed(2)}ms (${count} operations)`,
          recommendation,
          metrics: metrics
        })
      }
    })

    // Sort by severity
    return bottlenecks.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
      return severityOrder[b.severity] - severityOrder[a.severity]
    })
  }

  /**
   * Get resource usage trends
   */
  getResourceTrends(): { memory: TrendAnalysis; responseTime: TrendAnalysis; throughput: TrendAnalysis } {
    const recommendations: string[] = []
    
    if (this.resourceHistory.length < 2) {
      return {
        memory: { trend: 'stable', confidence: 0, recommendation: 'Insufficient data for analysis' },
        responseTime: { trend: 'stable', confidence: 0, recommendation: 'Insufficient data for analysis' },
        throughput: { trend: 'stable', confidence: 0, recommendation: 'Insufficient data for analysis' }
      }
    }

    // Analyze memory trend
    const recentMemory = this.resourceHistory.slice(-10)
    const memoryTrend = this.calculateTrend(recentMemory.map(r => r.memoryUsage))
    
    // Analyze error trend
    const errorTrend = this.calculateTrend(recentMemory.map(r => r.errorRate))

    // Generate recommendations based on trends
    if (memoryTrend === 'increasing') {
      recommendations.push('Memory usage is increasing - consider cache cleanup or memory optimization')
    }
    
    if (errorTrend === 'increasing') {
      recommendations.push('Error rate is increasing - check network connectivity and API health')
    }

    return {
      memory: { trend: memoryTrend, confidence: 0.8, recommendation: memoryTrend === 'increasing' ? 'Monitor memory usage' : '' },
      responseTime: { trend: errorTrend, confidence: 0.8, recommendation: errorTrend === 'increasing' ? 'Investigate performance issues' : '' },
      throughput: { trend: 'stable', confidence: 0.5, recommendation: 'Monitoring throughput' }
    }
  }

  /**
   * Clear performance data
   */
  clear(): void {
    this.metrics = []
    this.activeOperations.clear()
    this.resourceHistory = []
  }

  /**
   * Export performance data for analysis
   */
  exportData(): {
    metrics: PerformanceMetric[]
    resourceHistory: ResourceUsage[]
    report: PerformanceReport
    bottlenecks: PerformanceBottleneck[]
    trends: { memory: TrendAnalysis; responseTime: TrendAnalysis; throughput: TrendAnalysis }
  } {
    return {
      metrics: this.metrics,
      resourceHistory: this.resourceHistory,
      report: this.generateReport(),
      bottlenecks: this.getBottlenecks(),
      trends: this.getResourceTrends()
    }
  }

  /**
   * Private helper methods
   */
  private addMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric)
    
    // Trim metrics if too many
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }
  }

  private checkPerformanceThresholds(metric: PerformanceMetric): void {
    if (!metric.duration) return

    const threshold = this.getThresholdForOperation(metric.name)
    
    if (metric.duration > threshold * 2) {
      console.warn(`Slow operation detected: ${metric.name} took ${metric.duration.toFixed(2)}ms (threshold: ${threshold}ms)`)
    }
  }

  private getThresholdForOperation(operationName: string): number {
    const name = operationName.toLowerCase()
    
    if (name.includes('api') || name.includes('network')) {
      return this.thresholds.apiCall
    }
    if (name.includes('cache')) {
      return this.thresholds.cacheOperation
    }
    if (name.includes('websocket') || name.includes('message')) {
      return this.thresholds.websocketMessage
    }
    
    return this.thresholds.uiOperation
  }

  private generateRecommendations(metrics: PerformanceMetric[]): string[] {
    const recommendations: string[] = []
    
    // Analyze error rates
    const errorCount = metrics.filter(m => m.metadata?.success === false).length
    const errorRate = (errorCount / metrics.length) * 100
    
    if (errorRate > 10) {
      recommendations.push(`High error rate detected (${errorRate.toFixed(1)}%) - investigate failing operations`)
    }

    // Analyze operation frequency
    const operationCounts = new Map<string, number>()
    metrics.forEach(m => {
      operationCounts.set(m.name, (operationCounts.get(m.name) || 0) + 1)
    })

    const frequentOperations = Array.from(operationCounts.entries())
      .filter(([_, count]) => count > metrics.length * 0.2) // More than 20% of operations
      .map(([name]) => name)

    if (frequentOperations.length > 0) {
      recommendations.push(`Consider caching for frequent operations: ${frequentOperations.join(', ')}`)
    }

    return recommendations
  }

  private getMemoryUsage(): number {
    // Approximate memory usage calculation
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize
    }
    return 0
  }

  private calculateErrorRate(): number {
    const recentMetrics = this.metrics.slice(-50) // Last 50 operations
    if (recentMetrics.length === 0) return 0
    
    const errors = recentMetrics.filter(m => m.metadata?.success === false).length
    return (errors / recentMetrics.length) * 100
  }

  private calculateTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 2) return 'stable'
    
    const first = values[0]
    const last = values[values.length - 1]
    const change = ((last - first) / first) * 100
    
    if (change > 10) return 'increasing'
    if (change < -10) return 'decreasing'
    return 'stable'
  }
}

/**
 * Singleton instance
 */
export const performanceService = new PerformanceService()

/**
 * Performance monitoring decorator for methods
 */
export function performanceMonitor(operationName?: string) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    const name = operationName || `${target.constructor.name}.${propertyKey}`
    
    descriptor.value = async function(...args: any[]) {
      const operationId = `${name}-${Date.now()}-${Math.random()}`
      
      if (originalMethod.constructor.name === 'AsyncFunction') {
        return performanceService.timeAsync(operationId, name, () => originalMethod.apply(this, args))
      } else {
        return performanceService.timeSync(operationId, name, () => originalMethod.apply(this, args))
      }
    }
    
    return descriptor
  }
}