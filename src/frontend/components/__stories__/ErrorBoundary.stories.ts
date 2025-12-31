import type { Meta, StoryObj } from "@storybook/vue3";
import { ref, h, defineComponent } from "vue";
import ErrorBoundary from "../ErrorBoundary.vue";

/**
 * ErrorBoundary catches errors from child components and displays a fallback UI.
 * It integrates with FeedbackSystem for toast notifications and provides
 * error recovery functionality.
 */
const meta: Meta<typeof ErrorBoundary> = {
  title: "Components/ErrorBoundary",
  component: ErrorBoundary,
  tags: ["autodocs"],
  argTypes: {
    title: {
      control: "text",
      description: "Custom title for the error display",
    },
    showToast: {
      control: "boolean",
      description: "Whether to show toast notification on error",
    },
  },
};

export default meta;
type Story = StoryObj<typeof ErrorBoundary>;

// Component that renders normally
const NormalComponent = defineComponent({
  name: "NormalComponent",
  template: `
    <div style="padding: 24px; background: var(--sdpi-color-bg-secondary, #3c3c3c); border-radius: 8px;">
      <h4 style="color: #fff; margin: 0 0 8px;">Child Component</h4>
      <p style="color: #ccc; margin: 0;">This component renders normally without errors.</p>
    </div>
  `,
});

// Component that throws an error
const ErrorComponent = defineComponent({
  name: "ErrorComponent",
  setup() {
    throw new Error("This is a simulated component error");
  },
  template: "<div>This will never render</div>",
});

// Component with a button to trigger error
const TriggerableErrorComponent = defineComponent({
  name: "TriggerableErrorComponent",
  setup() {
    const shouldError = ref(false);

    const triggerError = () => {
      shouldError.value = true;
    };

    return () => {
      if (shouldError.value) {
        throw new Error("User triggered error!");
      }
      return h(
        "div",
        {
          style:
            "padding: 24px; background: var(--sdpi-color-bg-secondary, #3c3c3c); border-radius: 8px;",
        },
        [
          h(
            "h4",
            { style: "color: #fff; margin: 0 0 8px;" },
            "Interactive Component",
          ),
          h(
            "p",
            { style: "color: #ccc; margin: 0 0 16px;" },
            "Click the button below to trigger an error.",
          ),
          h(
            "button",
            {
              onClick: triggerError,
              style:
                "padding: 8px 16px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;",
            },
            "Trigger Error",
          ),
        ],
      );
    };
  },
});

/**
 * Default state with a normal child component that renders without errors.
 */
export const Default: Story = {
  render: () => ({
    components: { ErrorBoundary, NormalComponent },
    template: `
      <ErrorBoundary>
        <NormalComponent />
      </ErrorBoundary>
    `,
  }),
};

/**
 * Error state showing the default fallback UI when a child component throws an error.
 * Note: In Storybook, Vue's error boundary behavior may differ from production.
 */
export const ErrorState: Story = {
  render: () => ({
    components: { ErrorBoundary },
    setup() {
      // Simulate error state directly
      const hasError = ref(true);
      const errorMessage = "Failed to load component data";

      return { hasError, errorMessage };
    },
    template: `
      <div class="error-boundary">
        <div class="error-boundary__fallback">
          <div class="error-boundary__default">
            <div class="error-boundary__icon" style="color: #ff5555; margin-bottom: 16px;">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 style="margin: 0 0 8px; font-size: 18px; font-weight: 600; color: #ccc;">Something went wrong</h3>
            <p style="margin: 0 0 16px; font-size: 14px; color: #999; line-height: 1.5;">{{ errorMessage }}</p>
            <button style="padding: 10px 20px; border: none; border-radius: 4px; background-color: #0099ff; color: white; font-size: 14px; font-weight: 500; cursor: pointer;">
              Try Again
            </button>
          </div>
        </div>
      </div>
    `,
  }),
  parameters: {
    docs: {
      description: {
        story:
          "This shows the error fallback UI. In production, this appears when a child component throws an error.",
      },
    },
  },
};

/**
 * Error boundary with custom title.
 */
export const CustomTitle: Story = {
  render: () => ({
    components: { ErrorBoundary },
    template: `
      <div class="error-boundary">
        <div class="error-boundary__fallback" style="display: flex; align-items: center; justify-content: center; min-height: 200px; padding: 24px;">
          <div style="display: flex; flex-direction: column; align-items: center; text-align: center; max-width: 400px;">
            <div style="color: #ff5555; margin-bottom: 16px;">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 style="margin: 0 0 8px; font-size: 18px; font-weight: 600; color: #ccc;">Failed to load device data</h3>
            <p style="margin: 0 0 16px; font-size: 14px; color: #999;">Unable to communicate with the device. Please check your connection.</p>
            <button style="padding: 10px 20px; border: none; border-radius: 4px; background-color: #0099ff; color: white; font-size: 14px; cursor: pointer;">
              Try Again
            </button>
          </div>
        </div>
      </div>
    `,
  }),
};

/**
 * Interactive example where you can trigger an error.
 * Note: Error boundary behavior in Storybook may require page reload to reset.
 */
export const Interactive: Story = {
  render: () => ({
    components: { ErrorBoundary, TriggerableErrorComponent },
    template: `
      <div>
        <p style="color: #999; font-size: 12px; margin-bottom: 16px;">
          Click the button to trigger an error. The error boundary will catch it and display the fallback UI.
        </p>
        <ErrorBoundary title="Component crashed" :show-toast="false">
          <TriggerableErrorComponent />
        </ErrorBoundary>
      </div>
    `,
  }),
};

/**
 * Multiple error boundaries wrapping different sections.
 */
export const MultipleBoundaries: Story = {
  render: () => ({
    components: { ErrorBoundary, NormalComponent },
    template: `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <ErrorBoundary title="Section 1 Error">
          <NormalComponent />
        </ErrorBoundary>

        <ErrorBoundary title="Section 2 Error">
          <div style="padding: 24px; background: var(--sdpi-color-bg-secondary, #3c3c3c); border-radius: 8px;">
            <h4 style="color: #fff; margin: 0 0 8px;">Another Section</h4>
            <p style="color: #ccc; margin: 0;">Each section has its own error boundary for isolated error handling.</p>
          </div>
        </ErrorBoundary>

        <ErrorBoundary title="Section 3 Error">
          <div style="padding: 24px; background: var(--sdpi-color-bg-secondary, #3c3c3c); border-radius: 8px;">
            <h4 style="color: #fff; margin: 0 0 8px;">Third Section</h4>
            <p style="color: #ccc; margin: 0;">If one section fails, others continue working.</p>
          </div>
        </ErrorBoundary>
      </div>
    `,
  }),
};
