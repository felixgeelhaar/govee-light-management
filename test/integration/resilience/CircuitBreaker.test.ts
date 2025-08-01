import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker, CircuitState, CircuitBreakerOpenError, CircuitBreakerFactory } from '../../../src/backend/infrastructure/resilience/CircuitBreaker';

// Mock streamDeck logger
vi.mock('@elgato/streamdeck', () => ({
  default: {
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  },
}));

describe('CircuitBreaker Integration Tests', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker('test-circuit', {
      failureThreshold: 3,
      recoveryTimeout: 1000, // 1 second for testing
      successThreshold: 2,
      timeout: 500, // 0.5 seconds
    });
  });

  describe('Normal Operation (CLOSED state)', () => {
    it('should execute operations successfully when closed', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');

      const result = await circuitBreaker.execute(mockOperation);

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledOnce();
      expect(circuitBreaker.getStats().state).toBe(CircuitState.CLOSED);
    });

    it('should handle individual failures without opening', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Single failure'));

      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Single failure');
      expect(circuitBreaker.getStats().state).toBe(CircuitState.CLOSED);
      expect(circuitBreaker.getStats().failureCount).toBe(1);
    });
  });

  describe('Failure Threshold (CLOSED -> OPEN)', () => {
    it('should open circuit after reaching failure threshold', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Repeated failure'));

      // Execute enough failures to reach threshold
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockOperation);
        } catch (error) {
          // Expected to fail
        }
      }

      expect(circuitBreaker.getStats().state).toBe(CircuitState.OPEN);
      expect(circuitBreaker.getStats().failureCount).toBe(3);
    });

    it('should block all requests when OPEN', async () => {
      // Force circuit to open
      const failingOperation = vi.fn().mockRejectedValue(new Error('Force open'));
      
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch (error) {
          // Expected
        }
      }

      // Now circuit should be open
      const blockedOperation = vi.fn().mockResolvedValue('should not execute');
      
      await expect(circuitBreaker.execute(blockedOperation)).rejects.toThrow(CircuitBreakerOpenError);
      expect(blockedOperation).not.toHaveBeenCalled();
    });
  });

  describe('Recovery Process (OPEN -> HALF_OPEN -> CLOSED)', () => {
    it('should transition to HALF_OPEN after recovery timeout', async () => {
      // Force circuit to open
      const failingOperation = vi.fn().mockRejectedValue(new Error('Initial failures'));
      
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch (error) {
          // Expected
        }
      }

      expect(circuitBreaker.getStats().state).toBe(CircuitState.OPEN);

      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Next operation should transition to HALF_OPEN
      const testOperation = vi.fn().mockResolvedValue('test recovery');
      const result = await circuitBreaker.execute(testOperation);

      expect(result).toBe('test recovery');
      expect(circuitBreaker.getStats().state).toBe(CircuitState.HALF_OPEN);
    });

    it('should close circuit after successful operations in HALF_OPEN', async () => {
      // Force circuit to open
      await forceCircuitOpen(circuitBreaker);

      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Execute successful operations to meet success threshold
      const successOperation = vi.fn().mockResolvedValue('success');
      
      await circuitBreaker.execute(successOperation); // First success
      expect(circuitBreaker.getStats().state).toBe(CircuitState.HALF_OPEN);
      
      await circuitBreaker.execute(successOperation); // Second success
      expect(circuitBreaker.getStats().state).toBe(CircuitState.CLOSED);
    });

    it('should return to OPEN if operation fails in HALF_OPEN', async () => {
      // Force circuit to open
      await forceCircuitOpen(circuitBreaker);

      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Try a failing operation
      const failingOperation = vi.fn().mockRejectedValue(new Error('Still failing'));
      
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow('Still failing');
      expect(circuitBreaker.getStats().state).toBe(CircuitState.OPEN);
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout long-running operations', async () => {
      const longRunningOperation = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('too slow'), 1000))
      );

      await expect(circuitBreaker.execute(longRunningOperation)).rejects.toThrow('Operation timeout');
      expect(circuitBreaker.getStats().failureCount).toBe(1);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track comprehensive statistics', async () => {
      const successOperation = vi.fn().mockResolvedValue('success');
      const failOperation = vi.fn().mockRejectedValue(new Error('failure'));

      // Execute some operations
      await circuitBreaker.execute(successOperation);
      
      try {
        await circuitBreaker.execute(failOperation);
      } catch (error) {
        // Expected
      }

      const stats = circuitBreaker.getStats();
      
      expect(stats.totalCalls).toBe(2);
      expect(stats.totalSuccesses).toBe(1);
      expect(stats.totalFailures).toBe(1);
      expect(stats.failureCount).toBe(1);
      expect(stats.state).toBe(CircuitState.CLOSED);
    });

    it('should track last failure time', async () => {
      const failOperation = vi.fn().mockRejectedValue(new Error('test failure'));
      
      const beforeFailure = new Date();
      
      try {
        await circuitBreaker.execute(failOperation);
      } catch (error) {
        // Expected
      }

      const afterFailure = new Date();
      const stats = circuitBreaker.getStats();
      
      expect(stats.lastFailureTime).toBeDefined();
      expect(stats.lastFailureTime!.getTime()).toBeGreaterThanOrEqual(beforeFailure.getTime());
      expect(stats.lastFailureTime!.getTime()).toBeLessThanOrEqual(afterFailure.getTime());
    });
  });

  describe('Manual Control', () => {
    it('should allow manual reset', async () => {
      // Force circuit to open
      await forceCircuitOpen(circuitBreaker);
      expect(circuitBreaker.getStats().state).toBe(CircuitState.OPEN);

      // Reset manually
      circuitBreaker.reset();
      
      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitState.CLOSED);
      expect(stats.failureCount).toBe(0);
      expect(stats.successCount).toBe(0);
      expect(stats.lastFailureTime).toBeUndefined();
    });

    it('should allow manual force open', () => {
      expect(circuitBreaker.getStats().state).toBe(CircuitState.CLOSED);

      circuitBreaker.forceOpen();
      
      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitState.OPEN);
      expect(stats.nextAttemptTime).toBeDefined();
    });
  });

  describe('Factory Methods', () => {
    it('should create API circuit breaker with appropriate settings', () => {
      const apiBreaker = CircuitBreakerFactory.createApiCircuitBreaker('test-api');
      const stats = apiBreaker.getStats();
      
      expect(stats.state).toBe(CircuitState.CLOSED);
      // Factory should create with reasonable defaults for API calls
    });

    it('should create device circuit breaker with appropriate settings', () => {
      const deviceBreaker = CircuitBreakerFactory.createDeviceCircuitBreaker('device-123');
      const stats = deviceBreaker.getStats();
      
      expect(stats.state).toBe(CircuitState.CLOSED);
      // Factory should create with reasonable defaults for device operations
    });
  });

  describe('Edge Cases', () => {
    it('should handle immediate success after opening', async () => {
      // Force circuit to open
      await forceCircuitOpen(circuitBreaker);

      // Wait for recovery
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Immediate success should work
      const successOperation = vi.fn().mockResolvedValue('immediate success');
      const result = await circuitBreaker.execute(successOperation);
      
      expect(result).toBe('immediate success');
    });

    it('should handle rapid state transitions correctly', async () => {
      const operations: Promise<any>[] = [];
      
      // Execute multiple operations concurrently
      for (let i = 0; i < 5; i++) {
        if (i < 3) {
          // First 3 should fail
          operations.push(
            circuitBreaker.execute(() => Promise.reject(new Error(`Failure ${i}`))).catch(e => e)
          );
        } else {
          // Last 2 should be blocked or succeed depending on timing
          operations.push(
            circuitBreaker.execute(() => Promise.resolve(`Success ${i}`)).catch(e => e)
          );
        }
      }

      const results = await Promise.all(operations);
      
      // Should have some mix of failures and circuit breaker errors
      expect(results.length).toBe(5);
      expect(circuitBreaker.getStats().state).toBe(CircuitState.OPEN);
    });
  });

  // Helper function to force circuit breaker to open
  async function forceCircuitOpen(breaker: CircuitBreaker) {
    const failingOperation = vi.fn().mockRejectedValue(new Error('Force open'));
    
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(failingOperation);
      } catch (error) {
        // Expected to fail
      }
    }
  }
});