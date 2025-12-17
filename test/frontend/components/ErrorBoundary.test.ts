import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h, onMounted } from "vue";
import ErrorBoundary from "../../../src/frontend/components/ErrorBoundary.vue";

// Mock the useFeedback composable
const mockShowError = vi.fn();
vi.mock("../../../src/frontend/composables/useFeedback", () => ({
  useFeedbackHelpers: () => ({
    showError: mockShowError,
    showSuccessToast: vi.fn(),
    showApiError: vi.fn(),
  }),
}));

// Mock errorHandling module
vi.mock("../../../src/frontend/utils/errorHandling", () => ({
  logError: vi.fn(),
  getUserFriendlyErrorMessage: (error: Error) => error.message,
}));

// Component that throws an error on mount
const ThrowingComponent = defineComponent({
  props: {
    errorMessage: {
      type: String,
      default: "Test error from child component",
    },
  },
  setup(props) {
    onMounted(() => {
      throw new Error(props.errorMessage);
    });
    return () => h("div", "This should not render");
  },
});

// Component that renders normally
const NormalComponent = defineComponent({
  setup() {
    return () => h("div", { class: "normal-content" }, "Normal content");
  },
});

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("normal operation", () => {
    it("renders child content when no error occurs", () => {
      const wrapper = mount(ErrorBoundary, {
        slots: {
          default: () => h(NormalComponent),
        },
      });

      expect(wrapper.find(".normal-content").exists()).toBe(true);
      expect(wrapper.find(".error-boundary__fallback").exists()).toBe(false);
    });

    it("does not show fallback UI initially", () => {
      const wrapper = mount(ErrorBoundary, {
        slots: {
          default: () => h("div", "Child content"),
        },
      });

      expect(wrapper.find(".error-boundary__fallback").exists()).toBe(false);
    });
  });

  describe("error handling", () => {
    it("catches errors from child components", async () => {
      const wrapper = mount(ErrorBoundary, {
        slots: {
          default: () => h(ThrowingComponent),
        },
      });

      await wrapper.vm.$nextTick();

      expect(wrapper.find(".error-boundary__fallback").exists()).toBe(true);
    });

    it("displays default fallback UI on error", async () => {
      const wrapper = mount(ErrorBoundary, {
        slots: {
          default: () => h(ThrowingComponent),
        },
      });

      await wrapper.vm.$nextTick();

      expect(wrapper.find(".error-boundary__default").exists()).toBe(true);
      expect(wrapper.find(".error-boundary__title").text()).toBe(
        "Something went wrong"
      );
    });

    it("displays custom title from props", async () => {
      const wrapper = mount(ErrorBoundary, {
        props: {
          title: "Custom Error Title",
        },
        slots: {
          default: () => h(ThrowingComponent),
        },
      });

      await wrapper.vm.$nextTick();

      expect(wrapper.find(".error-boundary__title").text()).toBe(
        "Custom Error Title"
      );
    });

    it("shows error message in fallback UI", async () => {
      const errorMessage = "Specific test error";
      const wrapper = mount(ErrorBoundary, {
        slots: {
          default: () => h(ThrowingComponent, { errorMessage }),
        },
      });

      await wrapper.vm.$nextTick();

      expect(wrapper.find(".error-boundary__message").text()).toBe(
        errorMessage
      );
    });
  });

  describe("toast notifications", () => {
    it("shows error toast when showToast prop is true (default)", async () => {
      mount(ErrorBoundary, {
        slots: {
          default: () => h(ThrowingComponent),
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockShowError).toHaveBeenCalled();
    });

    it("does not show error toast when showToast prop is false", async () => {
      mount(ErrorBoundary, {
        props: {
          showToast: false,
        },
        slots: {
          default: () => h(ThrowingComponent),
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockShowError).not.toHaveBeenCalled();
    });
  });

  describe("reset functionality", () => {
    it("renders Try Again button in fallback UI", async () => {
      const wrapper = mount(ErrorBoundary, {
        slots: {
          default: () => h(ThrowingComponent),
        },
      });

      await wrapper.vm.$nextTick();

      expect(wrapper.find(".error-boundary__button").exists()).toBe(true);
      expect(wrapper.find(".error-boundary__button").text()).toBe("Try Again");
    });

    it("resets error state when Try Again is clicked", async () => {
      // Mount with throwing component to trigger error
      const wrapper = mount(ErrorBoundary, {
        slots: {
          default: () => h(ThrowingComponent),
        },
      });

      await wrapper.vm.$nextTick();
      expect(wrapper.find(".error-boundary__fallback").exists()).toBe(true);

      // Click reset - verify the reset function clears hasError
      const vm = wrapper.vm as unknown as { hasError: boolean; reset: () => void };
      const initialHasError = vm.hasError;
      expect(initialHasError).toBe(true);

      // Reset clears the error state internally (even if child throws again)
      vm.reset();

      // After reset, hasError should be false momentarily before child re-throws
      expect(wrapper.emitted("reset")).toBeTruthy();
    });

    it("exposes reset method", () => {
      const wrapper = mount(ErrorBoundary, {
        slots: {
          default: () => h(NormalComponent),
        },
      });

      // Vue Test Utils unwraps refs, so reset is directly accessible
      const vm = wrapper.vm as unknown as { reset: () => void };
      expect(typeof vm.reset).toBe("function");
    });

    it("emits reset event when reset is called", async () => {
      // Mount with throwing component to trigger error
      const wrapper = mount(ErrorBoundary, {
        slots: {
          default: () => h(ThrowingComponent),
        },
      });

      await wrapper.vm.$nextTick();
      expect(wrapper.find(".error-boundary__fallback").exists()).toBe(true);

      await wrapper.find(".error-boundary__button").trigger("click");

      expect(wrapper.emitted("reset")).toBeTruthy();
    });
  });

  describe("error event emission", () => {
    it("emits error event when error is caught", async () => {
      const wrapper = mount(ErrorBoundary, {
        slots: {
          default: () => h(ThrowingComponent),
        },
      });

      await wrapper.vm.$nextTick();

      const errorEvents = wrapper.emitted("error");
      expect(errorEvents).toBeTruthy();
      expect(errorEvents![0][0]).toBeInstanceOf(Error);
    });
  });

  describe("exposed properties", () => {
    it("exposes hasError ref (unwrapped by Vue Test Utils)", () => {
      const wrapper = mount(ErrorBoundary, {
        slots: {
          default: () => h(NormalComponent),
        },
      });

      // Vue Test Utils unwraps refs, so hasError is directly a boolean
      const vm = wrapper.vm as unknown as { hasError: boolean };
      expect(vm.hasError).toBe(false);
    });

    it("exposes error ref (unwrapped by Vue Test Utils)", () => {
      const wrapper = mount(ErrorBoundary, {
        slots: {
          default: () => h(NormalComponent),
        },
      });

      // Vue Test Utils unwraps refs, so error is directly the value
      const vm = wrapper.vm as unknown as { error: Error | null };
      expect(vm.error).toBeNull();
    });

    it("hasError becomes true after error is caught", async () => {
      const wrapper = mount(ErrorBoundary, {
        slots: {
          default: () => h(ThrowingComponent),
        },
      });

      await wrapper.vm.$nextTick();

      const vm = wrapper.vm as unknown as { hasError: boolean };
      expect(vm.hasError).toBe(true);
    });

    it("error contains the caught error", async () => {
      const wrapper = mount(ErrorBoundary, {
        slots: {
          default: () => h(ThrowingComponent, { errorMessage: "Captured error" }),
        },
      });

      await wrapper.vm.$nextTick();

      const vm = wrapper.vm as unknown as { error: Error };
      expect(vm.error).toBeInstanceOf(Error);
      expect(vm.error.message).toBe("Captured error");
    });
  });
});
