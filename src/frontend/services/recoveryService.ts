/**
 * Advanced error recovery and resilience service
 * Implements intelligent recovery strategies for various failure scenarios
 */

import { websocketService } from "./websocketService";
import { apiCacheService } from "./cacheService";
import { performanceService } from "./performanceService";
import { isRecoverableError } from "../utils/errorHandling";

export interface RecoveryStrategy {
  name: string;
  condition: (error: Error) => boolean;
  recover: () => Promise<boolean>;
  maxRetries: number;
  backoffMs: number;
}

export interface RecoveryAttempt {
  strategy: string;
  timestamp: number;
  success: boolean;
  error?: string;
  duration: number;
}

export interface CircuitBreakerState {
  isOpen: boolean;
  failureCount: number;
  lastFailureTime: number;
  nextRetryTime: number;
}

/**
 * Advanced error recovery service with circuit breaker pattern
 */
export class RecoveryService {
  private recoveryHistory: RecoveryAttempt[] = [];
  private circuitBreakers = new Map<string, CircuitBreakerState>();
  private strategies: RecoveryStrategy[] = [];

  // Circuit breaker thresholds
  private readonly FAILURE_THRESHOLD = 5;
  private readonly RECOVERY_TIMEOUT = 30000; // 30 seconds
  private readonly HALF_OPEN_TIMEOUT = 10000; // 10 seconds

  constructor() {
    this.initializeStrategies();
  }

  /**
   * Attempt to recover from an error using available strategies
   */
  async attemptRecovery(
    error: Error,
    _context?: Record<string, unknown>,
  ): Promise<boolean> {
    // Don't attempt recovery for non-recoverable errors
    if (!isRecoverableError(error)) {
      console.log(
        "Error not recoverable, skipping recovery attempts",
        error.message,
      );
      return false;
    }

    // Find applicable recovery strategies
    const applicableStrategies = this.strategies.filter((strategy) =>
      strategy.condition(error),
    );

    if (applicableStrategies.length === 0) {
      console.log(
        "No applicable recovery strategies found for error:",
        error.message,
      );
      return false;
    }

    // Try each strategy in order
    for (const strategy of applicableStrategies) {
      const circuitBreakerKey = `strategy-${strategy.name}`;

      // Check circuit breaker
      if (this.isCircuitOpen(circuitBreakerKey)) {
        console.log(`Circuit breaker open for strategy: ${strategy.name}`);
        continue;
      }

      try {
        const operationId = `recovery-${strategy.name}-${Date.now()}`;
        const startTime = Date.now();

        console.log(`Attempting recovery with strategy: ${strategy.name}`);

        const success = await performanceService.timeAsync(
          operationId,
          `Recovery: ${strategy.name}`,
          () => strategy.recover(),
        );

        const duration = Date.now() - startTime;

        // Record successful recovery
        this.recordRecoveryAttempt({
          strategy: strategy.name,
          timestamp: startTime,
          success,
          duration,
        });

        if (success) {
          console.log(`Recovery successful with strategy: ${strategy.name}`);
          this.resetCircuitBreaker(circuitBreakerKey);
          return true;
        } else {
          this.recordFailure(circuitBreakerKey);
        }
      } catch (recoveryError) {
        const duration = Date.now() - Date.now();

        // Record failed recovery attempt
        this.recordRecoveryAttempt({
          strategy: strategy.name,
          timestamp: Date.now(),
          success: false,
          error:
            recoveryError instanceof Error
              ? recoveryError.message
              : "Unknown error",
          duration,
        });

        this.recordFailure(circuitBreakerKey);
        console.error(
          `Recovery strategy failed: ${strategy.name}`,
          recoveryError,
        );
      }
    }

    return false;
  }

  /**
   * Check if a specific service or operation should be attempted
   */
  shouldAttemptOperation(operationKey: string): boolean {
    return !this.isCircuitOpen(operationKey);
  }

  /**
   * Record successful operation to reset circuit breaker
   */
  recordSuccess(operationKey: string): void {
    this.resetCircuitBreaker(operationKey);
  }

  /**
   * Record failed operation for circuit breaker
   */
  recordFailure(operationKey: string): void {
    const state = this.getCircuitBreakerState(operationKey);
    state.failureCount++;
    state.lastFailureTime = Date.now();

    if (state.failureCount >= this.FAILURE_THRESHOLD) {
      state.isOpen = true;
      state.nextRetryTime = Date.now() + this.RECOVERY_TIMEOUT;
      console.warn(`Circuit breaker opened for: ${operationKey}`);
    }

    this.circuitBreakers.set(operationKey, state);
  }

  /**
   * Get recovery statistics and insights
   */
  getRecoveryStats(): {
    totalAttempts: number;
    successRate: number;
    strategiesUsed: Record<string, number>;
    recentFailures: RecoveryAttempt[];
    circuitBreakerStatus: Array<{ key: string; state: CircuitBreakerState }>;
  } {
    const totalAttempts = this.recoveryHistory.length;
    const successfulAttempts = this.recoveryHistory.filter(
      (a) => a.success,
    ).length;
    const successRate =
      totalAttempts > 0 ? (successfulAttempts / totalAttempts) * 100 : 0;

    const strategiesUsed: Record<string, number> = {};
    this.recoveryHistory.forEach((attempt) => {
      strategiesUsed[attempt.strategy] =
        (strategiesUsed[attempt.strategy] || 0) + 1;
    });

    const recentFailures = this.recoveryHistory
      .filter((a) => !a.success && Date.now() - a.timestamp < 300000) // Last 5 minutes
      .slice(-10); // Last 10 failures

    const circuitBreakerStatus = Array.from(this.circuitBreakers.entries()).map(
      ([key, state]) => ({
        key,
        state: { ...state },
      }),
    );

    return {
      totalAttempts,
      successRate: Number(successRate.toFixed(2)),
      strategiesUsed,
      recentFailures,
      circuitBreakerStatus,
    };
  }

  /**
   * Perform system health check and recovery
   */
  async performHealthCheck(): Promise<{
    overallHealth: "healthy" | "degraded" | "unhealthy";
    issues: string[];
    recoveryActions: string[];
  }> {
    const issues: string[] = [];
    const recoveryActions: string[] = [];

    // Check WebSocket connection
    if (!websocketService.isConnected) {
      issues.push("WebSocket disconnected");
      recoveryActions.push("Attempting WebSocket reconnection");

      try {
        // WebSocket service should auto-reconnect, but we can force it
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (!websocketService.isConnected) {
          issues.push("WebSocket reconnection failed");
        }
      } catch (_error) {
        issues.push("WebSocket recovery failed");
      }
    }

    // Check cache health
    const cacheHealth = apiCacheService.getHealthStatus();
    if (cacheHealth.status !== "healthy") {
      issues.push(
        `Cache ${cacheHealth.status}: ${cacheHealth.recommendations.join(", ")}`,
      );

      if (cacheHealth.status === "critical") {
        recoveryActions.push("Clearing cache to free memory");
        apiCacheService.clear();
      }
    }

    // Check performance trends
    const performanceData = performanceService.getResourceTrends();
    if (performanceData.memory.trend === "increasing") {
      issues.push("Memory usage increasing");
      recoveryActions.push("Suggesting memory optimization");
    }

    // Check circuit breaker states
    const openCircuits = Array.from(this.circuitBreakers.entries()).filter(
      ([, state]) => state.isOpen,
    );

    if (openCircuits.length > 0) {
      issues.push(`${openCircuits.length} circuit breaker(s) open`);
      recoveryActions.push("Monitoring for recovery opportunities");
    }

    // Determine overall health
    let overallHealth: "healthy" | "degraded" | "unhealthy" = "healthy";
    if (issues.length > 3) {
      overallHealth = "unhealthy";
    } else if (issues.length > 0) {
      overallHealth = "degraded";
    }

    return {
      overallHealth,
      issues,
      recoveryActions,
    };
  }

  /**
   * Clear recovery history and reset circuit breakers
   */
  reset(): void {
    this.recoveryHistory = [];
    this.circuitBreakers.clear();
  }

  /**
   * Private helper methods
   */
  private initializeStrategies(): void {
    this.strategies = [
      // WebSocket reconnection strategy
      {
        name: "websocket-reconnect",
        condition: (error) =>
          error.message.includes("WebSocket") ||
          error.message.includes("not connected"),
        recover: async () => {
          if (!websocketService.isConnected) {
            // Wait for auto-reconnection or force reconnection
            await new Promise((resolve) => setTimeout(resolve, 2000));
            return websocketService.isConnected;
          }
          return true;
        },
        maxRetries: 3,
        backoffMs: 2000,
      },

      // Cache invalidation strategy
      {
        name: "cache-invalidate",
        condition: (error) =>
          error.message.includes("Invalid API key") ||
          error.message.includes("cache"),
        recover: async () => {
          try {
            // Get current API key from settings
            const settings = websocketService.getCurrentSettings();
            if (settings?.apiKey) {
              apiCacheService.invalidateApiKey(settings.apiKey);
              console.log("Cache invalidated for current API key");
            }
            return true;
          } catch {
            return false;
          }
        },
        maxRetries: 1,
        backoffMs: 1000,
      },

      // Settings refresh strategy
      {
        name: "settings-refresh",
        condition: (error) =>
          error.message.includes("settings") ||
          error.message.includes("configuration"),
        recover: async () => {
          try {
            websocketService.requestSettings();
            // Wait for settings to be updated
            await new Promise((resolve) => setTimeout(resolve, 1000));
            return true;
          } catch {
            return false;
          }
        },
        maxRetries: 2,
        backoffMs: 1500,
      },

      // Memory cleanup strategy
      {
        name: "memory-cleanup",
        condition: (error) =>
          error.message.includes("memory") ||
          error.message.includes("out of memory"),
        recover: async () => {
          try {
            // Clear performance history
            performanceService.clear();

            // Clear old cache entries
            apiCacheService.clear();

            // Force garbage collection if available
            if (global.gc) {
              global.gc();
            }

            return true;
          } catch {
            return false;
          }
        },
        maxRetries: 1,
        backoffMs: 5000,
      },

      // Generic retry strategy
      {
        name: "generic-retry",
        condition: (error) =>
          error.message.includes("timeout") ||
          error.message.includes("network") ||
          error.message.includes("temporary"),
        recover: async () => {
          // Simple wait and retry
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return true;
        },
        maxRetries: 2,
        backoffMs: 2000,
      },
    ];
  }

  private isCircuitOpen(key: string): boolean {
    const state = this.circuitBreakers.get(key);
    if (!state || !state.isOpen) {
      return false;
    }

    // Check if circuit should move to half-open state
    if (Date.now() >= state.nextRetryTime) {
      state.isOpen = false;
      state.nextRetryTime = Date.now() + this.HALF_OPEN_TIMEOUT;
      this.circuitBreakers.set(key, state);
      console.log(`Circuit breaker moved to half-open for: ${key}`);
      return false;
    }

    return true;
  }

  private getCircuitBreakerState(key: string): CircuitBreakerState {
    return (
      this.circuitBreakers.get(key) || {
        isOpen: false,
        failureCount: 0,
        lastFailureTime: 0,
        nextRetryTime: 0,
      }
    );
  }

  private resetCircuitBreaker(key: string): void {
    this.circuitBreakers.set(key, {
      isOpen: false,
      failureCount: 0,
      lastFailureTime: 0,
      nextRetryTime: 0,
    });
  }

  private recordRecoveryAttempt(attempt: RecoveryAttempt): void {
    this.recoveryHistory.push(attempt);

    // Keep only last 100 attempts
    if (this.recoveryHistory.length > 100) {
      this.recoveryHistory = this.recoveryHistory.slice(-100);
    }
  }
}

/**
 * Singleton instance
 */
export const recoveryService = new RecoveryService();

/**
 * Auto-recovery decorator for methods
 */
export function withAutoRecovery(maxRetries: number = 3) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      let lastError: Error;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          lastError = error as Error;

          if (attempt === maxRetries) {
            // Final attempt failed, try recovery
            const recovered = await recoveryService.attemptRecovery(lastError);
            if (recovered) {
              // If recovery succeeded, try the operation one more time
              return await originalMethod.apply(this, args);
            }
            throw lastError;
          }

          // Wait before retry with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      throw lastError!;
    };

    return descriptor;
  };
}
