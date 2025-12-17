import type { Meta, StoryObj } from '@storybook/vue3';
import LoadingSpinner from '../LoadingSpinner.vue';

/**
 * LoadingSpinner is a customizable animated loading indicator.
 * It supports multiple color variants and sizes for different use cases
 * in the Stream Deck Property Inspector UI.
 */
const meta: Meta<typeof LoadingSpinner> = {
  title: 'Components/LoadingSpinner',
  component: LoadingSpinner,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'range', min: 16, max: 96, step: 4 },
      description: 'Size of the spinner in pixels',
    },
    variant: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'light', 'dark'],
      description: 'Color variant of the spinner',
    },
    strokeWidth: {
      control: { type: 'range', min: 1, max: 8, step: 1 },
      description: 'Width of the spinner stroke',
    },
  },
};

export default meta;
type Story = StoryObj<typeof LoadingSpinner>;

/**
 * Default loading spinner with primary color variant.
 */
export const Default: Story = {
  args: {
    size: 32,
    variant: 'primary',
    strokeWidth: 3,
  },
};

/**
 * Small spinner for inline use in buttons or tight spaces.
 */
export const Small: Story = {
  args: {
    size: 16,
    variant: 'primary',
    strokeWidth: 2,
  },
};

/**
 * Large spinner for page-level loading states.
 */
export const Large: Story = {
  args: {
    size: 64,
    variant: 'primary',
    strokeWidth: 4,
  },
};

/**
 * Secondary variant for less prominent loading states.
 */
export const Secondary: Story = {
  args: {
    size: 32,
    variant: 'secondary',
    strokeWidth: 3,
  },
};

/**
 * Light variant for use on dark backgrounds.
 */
export const Light: Story = {
  args: {
    size: 32,
    variant: 'light',
    strokeWidth: 3,
  },
};

/**
 * Dark variant for use on light backgrounds.
 */
export const Dark: Story = {
  args: {
    size: 32,
    variant: 'dark',
    strokeWidth: 3,
  },
  parameters: {
    backgrounds: { default: 'white' },
  },
};

/**
 * All variants displayed together for comparison.
 */
export const AllVariants: Story = {
  render: () => ({
    components: { LoadingSpinner },
    template: `
      <div style="display: flex; gap: 24px; align-items: center;">
        <div style="text-align: center;">
          <LoadingSpinner variant="primary" />
          <p style="color: #ccc; margin-top: 8px; font-size: 12px;">Primary</p>
        </div>
        <div style="text-align: center;">
          <LoadingSpinner variant="secondary" />
          <p style="color: #ccc; margin-top: 8px; font-size: 12px;">Secondary</p>
        </div>
        <div style="text-align: center;">
          <LoadingSpinner variant="light" />
          <p style="color: #ccc; margin-top: 8px; font-size: 12px;">Light</p>
        </div>
        <div style="text-align: center; background: #fff; padding: 16px; border-radius: 4px;">
          <LoadingSpinner variant="dark" />
          <p style="color: #333; margin-top: 8px; font-size: 12px;">Dark</p>
        </div>
      </div>
    `,
  }),
};

/**
 * Different sizes displayed together for comparison.
 */
export const AllSizes: Story = {
  render: () => ({
    components: { LoadingSpinner },
    template: `
      <div style="display: flex; gap: 24px; align-items: center;">
        <div style="text-align: center;">
          <LoadingSpinner :size="16" :stroke-width="2" />
          <p style="color: #ccc; margin-top: 8px; font-size: 12px;">16px</p>
        </div>
        <div style="text-align: center;">
          <LoadingSpinner :size="24" />
          <p style="color: #ccc; margin-top: 8px; font-size: 12px;">24px</p>
        </div>
        <div style="text-align: center;">
          <LoadingSpinner :size="32" />
          <p style="color: #ccc; margin-top: 8px; font-size: 12px;">32px</p>
        </div>
        <div style="text-align: center;">
          <LoadingSpinner :size="48" :stroke-width="4" />
          <p style="color: #ccc; margin-top: 8px; font-size: 12px;">48px</p>
        </div>
        <div style="text-align: center;">
          <LoadingSpinner :size="64" :stroke-width="5" />
          <p style="color: #ccc; margin-top: 8px; font-size: 12px;">64px</p>
        </div>
      </div>
    `,
  }),
};
