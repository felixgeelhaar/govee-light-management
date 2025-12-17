import { describe, it, expect, vi, beforeEach } from "vitest";
import { useErrorHandler, useMultipleErrorHandlers } from "../../../src/frontend/composables/useErrorHandler";
import { ErrorCodes } from "../../../src/frontend/utils/errorHandling";

// Mock the useFeedback composable
vi.mock("../../../src/frontend/composables/useFeedback", () => ({
  useFeedbackHelpers: () => ({
    showError: vi.fn(),
    showSuccessToast: vi.fn(),
    showApiError: vi.fn(),
  }),
}));

describe("useErrorHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("execute", () => {
    it("returns result on successful operation", async () => {
      const { execute } = useErrorHandler();
      const mockOperation = vi.fn().mockResolvedValue("success");

      const result = await execute(mockOperation, "Test operation");

      expect(result).toBe("success");
      expect(mockOperation).toHaveBeenCalled();
    });

    it("sets isLoading to true during execution", async () => {
      const { execute, isLoading } = useErrorHandler();
      let loadingDuringExecution = false;

      const mockOperation = vi.fn().mockImplementation(async () => {
        loadingDuringExecution = isLoading.value;
        return "success";
      });

      await execute(mockOperation);

      expect(loadingDuringExecution).toBe(true);
      expect(isLoading.value).toBe(false);
    });

    it("sets isLoading to false after execution completes", async () => {
      const { execute, isLoading } = useErrorHandler();
      const mockOperation = vi.fn().mockResolvedValue("success");

      await execute(mockOperation);

      expect(isLoading.value).toBe(false);
    });

    it("returns null and sets error on failed operation", async () => {
      const { execute, error } = useErrorHandler();
      const mockError = new Error("Test error");
      const mockOperation = vi.fn().mockRejectedValue(mockError);

      const result = await execute(mockOperation, "Test operation");

      expect(result).toBeNull();
      expect(error.value).not.toBeNull();
      expect(error.value?.message).toBe("Test error");
    });

    it("sets error code to SYSTEM_ERROR for generic errors", async () => {
      const { execute, error } = useErrorHandler();
      const mockOperation = vi.fn().mockRejectedValue(new Error("Generic error"));

      await execute(mockOperation);

      expect(error.value?.code).toBe(ErrorCodes.SYSTEM_ERROR);
    });

    it("preserves AppError properties if error is already an AppError", async () => {
      const { execute, error } = useErrorHandler();
      const appError = Object.assign(new Error("App error"), {
        code: ErrorCodes.API_ERROR,
        recoverable: true,
      });
      const mockOperation = vi.fn().mockRejectedValue(appError);

      await execute(mockOperation);

      expect(error.value?.code).toBe(ErrorCodes.API_ERROR);
    });

    it("sets isLoading to false even after failed operation", async () => {
      const { execute, isLoading } = useErrorHandler();
      const mockOperation = vi.fn().mockRejectedValue(new Error("Failure"));

      await execute(mockOperation);

      expect(isLoading.value).toBe(false);
    });
  });

  describe("clearError", () => {
    it("clears the error state", async () => {
      const { execute, error, clearError } = useErrorHandler();
      const mockOperation = vi.fn().mockRejectedValue(new Error("Test error"));

      await execute(mockOperation);
      expect(error.value).not.toBeNull();

      clearError();
      expect(error.value).toBeNull();
    });

    it("resets canRetry to false", async () => {
      const { execute, clearError, canRetry } = useErrorHandler({ retryable: true });
      const mockOperation = vi.fn().mockRejectedValue(
        Object.assign(new Error("Recoverable"), { recoverable: true })
      );

      await execute(mockOperation);
      clearError();

      expect(canRetry.value).toBe(false);
    });
  });

  describe("retry", () => {
    it("re-executes the last operation", async () => {
      const { execute, retry, canRetry } = useErrorHandler({ retryable: true });
      let callCount = 0;
      const mockOperation = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(Object.assign(new Error("First failure"), { recoverable: true }));
        }
        return Promise.resolve("success");
      });

      await execute(mockOperation);
      expect(callCount).toBe(1);

      await retry();
      expect(callCount).toBe(2);
    });

    it("does nothing if no previous operation", async () => {
      const { retry } = useErrorHandler();

      // Should not throw
      await retry();
    });

    it("does nothing if canRetry is false", async () => {
      const { execute, retry, canRetry } = useErrorHandler({ retryable: false });
      const mockOperation = vi.fn().mockRejectedValue(new Error("Error"));

      await execute(mockOperation);
      expect(canRetry.value).toBe(false);

      await retry();
      // Operation should only be called once (initial execute)
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });
  });

  describe("options", () => {
    it("calls onSuccess callback on successful operation", async () => {
      const onSuccess = vi.fn();
      const { execute } = useErrorHandler({ onSuccess });
      const mockOperation = vi.fn().mockResolvedValue("success");

      await execute(mockOperation);

      expect(onSuccess).toHaveBeenCalled();
    });

    it("does not call onSuccess callback on failed operation", async () => {
      const onSuccess = vi.fn();
      const { execute } = useErrorHandler({ onSuccess });
      const mockOperation = vi.fn().mockRejectedValue(new Error("Error"));

      await execute(mockOperation);

      expect(onSuccess).not.toHaveBeenCalled();
    });

    it("calls onError callback on failed operation", async () => {
      const onError = vi.fn();
      const { execute } = useErrorHandler({ onError });
      const mockOperation = vi.fn().mockRejectedValue(new Error("Test error"));

      await execute(mockOperation);

      expect(onError).toHaveBeenCalled();
      expect(onError.mock.calls[0][0].message).toBe("Test error");
    });

    it("does not call onError callback on successful operation", async () => {
      const onError = vi.fn();
      const { execute } = useErrorHandler({ onError });
      const mockOperation = vi.fn().mockResolvedValue("success");

      await execute(mockOperation);

      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe("canRetry", () => {
    it("is true when error is recoverable and retryable option is true", async () => {
      const { execute, canRetry } = useErrorHandler({ retryable: true });
      const recoverableError = Object.assign(new Error("Recoverable"), { recoverable: true });
      const mockOperation = vi.fn().mockRejectedValue(recoverableError);

      await execute(mockOperation);

      expect(canRetry.value).toBe(true);
    });

    it("is false when retryable option is false", async () => {
      const { execute, canRetry } = useErrorHandler({ retryable: false });
      const recoverableError = Object.assign(new Error("Recoverable"), { recoverable: true });
      const mockOperation = vi.fn().mockRejectedValue(recoverableError);

      await execute(mockOperation);

      expect(canRetry.value).toBe(false);
    });

    it("is false initially", () => {
      const { canRetry } = useErrorHandler();

      expect(canRetry.value).toBe(false);
    });
  });
});

describe("useMultipleErrorHandlers", () => {
  it("creates multiple error handlers from config", () => {
    const handlers = useMultipleErrorHandlers({
      loadData: { showErrorToast: true },
      saveData: { showErrorToast: false },
    });

    expect(handlers.loadData).toBeDefined();
    expect(handlers.saveData).toBeDefined();
    expect(typeof handlers.loadData.execute).toBe("function");
    expect(typeof handlers.saveData.execute).toBe("function");
  });

  it("handlers operate independently", async () => {
    const handlers = useMultipleErrorHandlers({
      handler1: {},
      handler2: {},
    });

    const error1 = new Error("Error 1");
    const error2 = new Error("Error 2");

    await handlers.handler1.execute(() => Promise.reject(error1));
    await handlers.handler2.execute(() => Promise.resolve("success"));

    expect(handlers.handler1.error.value?.message).toBe("Error 1");
    expect(handlers.handler2.error.value).toBeNull();
  });
});
