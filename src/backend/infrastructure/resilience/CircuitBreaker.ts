import streamDeck from "@elgato/streamdeck";

/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures by temporarily blocking calls to failing services
 */

export enum CircuitState {
  CLOSED = "closed", // Normal operation
  OPEN = "open", // Failing, blocking all requests
  HALF_OPEN = "half_open", // Testing if service has recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  recoveryTimeout: number; // Time to wait before trying again (ms)
  successThreshold: number; // Successes needed to close from half-open
  timeout: number; // Request timeout (ms)
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
  totalCalls: number;
  totalFailures: number;
  totalSuccesses: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: Date;
  private nextAttemptTime?: Date;
  private totalCalls = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;

  constructor(
    private readonly name: string,
    private readonly config: CircuitBreakerConfig,
  ) {
    streamDeck.logger.info(`Circuit breaker initialized: ${name}`, config);
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.totalCalls++;

    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        streamDeck.logger.info(
          `Circuit breaker ${this.name} transitioning to HALF_OPEN`,
        );
      } else {
        throw new CircuitBreakerOpenError(
          `Circuit breaker ${this.name} is OPEN. Next attempt at ${this.nextAttemptTime?.toISOString()}`,
        );
      }
    }

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("Operation timeout")),
          this.config.timeout,
        );
      });

      const result = await Promise.race([operation(), timeoutPromise]);

      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.totalSuccesses++;
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        streamDeck.logger.info(
          `Circuit breaker ${this.name} CLOSED - service recovered`,
        );
      }
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(): void {
    this.totalFailures++;
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      this.setNextAttemptTime();
      streamDeck.logger.warn(
        `Circuit breaker ${this.name} OPEN - service still failing`,
      );
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.setNextAttemptTime();
      streamDeck.logger.warn(
        `Circuit breaker ${this.name} OPEN - failure threshold reached (${this.failureCount}/${this.config.failureThreshold})`,
      );
    }
  }

  /**
   * Check if we should attempt to reset the circuit breaker
   */
  private shouldAttemptReset(): boolean {
    if (!this.nextAttemptTime) return true;
    return Date.now() >= this.nextAttemptTime.getTime();
  }

  /**
   * Set the next attempt time based on recovery timeout
   */
  private setNextAttemptTime(): void {
    this.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
      totalCalls: this.totalCalls,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    };
  }

  /**
   * Reset circuit breaker to closed state (for testing or manual recovery)
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
    this.nextAttemptTime = undefined;
    streamDeck.logger.info(`Circuit breaker ${this.name} manually reset`);
  }

  /**
   * Force circuit breaker to open state (for maintenance)
   */
  forceOpen(): void {
    this.state = CircuitState.OPEN;
    this.setNextAttemptTime();
    streamDeck.logger.info(`Circuit breaker ${this.name} manually opened`);
  }
}

/**
 * Error thrown when circuit breaker is open
 */
export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CircuitBreakerOpenError";
  }
}

/**
 * Circuit breaker factory for common configurations
 */
export class CircuitBreakerFactory {
  /**
   * Create circuit breaker for API calls
   */
  static createApiCircuitBreaker(name: string): CircuitBreaker {
    return new CircuitBreaker(name, {
      failureThreshold: 5, // 5 failures before opening
      recoveryTimeout: 30000, // Wait 30 seconds before retry
      successThreshold: 2, // 2 successes to close
      timeout: 10000, // 10 second timeout per request
    });
  }

  /**
   * Create circuit breaker for device control operations
   */
  static createDeviceCircuitBreaker(deviceId: string): CircuitBreaker {
    return new CircuitBreaker(`device-${deviceId}`, {
      failureThreshold: 3, // 3 failures before opening (devices fail faster)
      recoveryTimeout: 60000, // Wait 1 minute before retry (devices need more time)
      successThreshold: 1, // 1 success to close (be optimistic about recovery)
      timeout: 15000, // 15 second timeout (device operations can be slower)
    });
  }
}
