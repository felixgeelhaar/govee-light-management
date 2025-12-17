import type { Meta, StoryObj } from '@storybook/vue3';
import { ref } from 'vue';
import FormInput from '../FormInput.vue';

/**
 * FormInput is a reusable form input component with built-in validation,
 * accessibility features, and consistent styling for Stream Deck Property Inspectors.
 */
const meta: Meta<typeof FormInput> = {
  title: 'Components/FormInput',
  component: FormInput,
  tags: ['autodocs'],
  argTypes: {
    id: {
      control: 'text',
      description: 'Unique identifier for the input element',
    },
    modelValue: {
      control: 'text',
      description: 'Current value (v-model binding)',
    },
    label: {
      control: 'text',
      description: 'Label text displayed above the input',
    },
    type: {
      control: { type: 'select' },
      options: ['text', 'number', 'password', 'email', 'url'],
      description: 'HTML input type',
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder text when input is empty',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the input is disabled',
    },
    required: {
      control: 'boolean',
      description: 'Whether the field is required',
    },
    helpText: {
      control: 'text',
      description: 'Help text displayed below the input',
    },
    min: {
      control: 'number',
      description: 'Minimum value for number inputs',
    },
    max: {
      control: 'number',
      description: 'Maximum value for number inputs',
    },
    step: {
      control: 'number',
      description: 'Step increment for number inputs',
    },
  },
};

export default meta;
type Story = StoryObj<typeof FormInput>;

/**
 * Default text input with label.
 */
export const Default: Story = {
  args: {
    id: 'default-input',
    modelValue: '',
    label: 'Username',
    placeholder: 'Enter your username',
  },
};

/**
 * Text input with help text providing additional guidance.
 */
export const WithHelpText: Story = {
  args: {
    id: 'help-input',
    modelValue: '',
    label: 'API Key',
    placeholder: 'Enter your Govee API key',
    helpText: 'You can find your API key in the Govee app under Settings > Developer API',
  },
};

/**
 * Required field with visual indicator.
 */
export const Required: Story = {
  args: {
    id: 'required-input',
    modelValue: '',
    label: 'Device Name',
    placeholder: 'Enter device name',
    required: true,
  },
};

/**
 * Disabled input that cannot be edited.
 */
export const Disabled: Story = {
  args: {
    id: 'disabled-input',
    modelValue: 'Locked value',
    label: 'Device ID',
    disabled: true,
  },
};

/**
 * Number input with min/max range validation.
 */
export const NumberWithRange: Story = {
  args: {
    id: 'brightness-input',
    modelValue: 50,
    label: 'Brightness',
    type: 'number',
    min: 0,
    max: 100,
    step: 5,
    helpText: 'Set brightness level (0-100%)',
  },
};

/**
 * Password input for sensitive data.
 */
export const Password: Story = {
  args: {
    id: 'password-input',
    modelValue: '',
    label: 'Password',
    type: 'password',
    placeholder: 'Enter your password',
    required: true,
  },
};

/**
 * Input with custom validation showing error state.
 */
export const WithValidationError: Story = {
  render: () => ({
    components: { FormInput },
    setup() {
      const value = ref('abc');
      const validator = (val: string | number) => {
        const str = String(val);
        if (str.length < 32) {
          return 'API key must be at least 32 characters';
        }
        return null;
      };
      return { value, validator };
    },
    template: `
      <FormInput
        id="validation-input"
        v-model="value"
        label="API Key"
        :validator="validator"
        help-text="Enter your 32+ character API key"
      />
      <p style="color: #999; font-size: 12px; margin-top: 8px;">
        Blur the input to trigger validation
      </p>
    `,
  }),
};

/**
 * All input types displayed together for comparison.
 */
export const AllTypes: Story = {
  render: () => ({
    components: { FormInput },
    setup() {
      const textValue = ref('Sample text');
      const numberValue = ref(75);
      const passwordValue = ref('secret123');
      const emailValue = ref('user@example.com');
      return { textValue, numberValue, passwordValue, emailValue };
    },
    template: `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <FormInput
          id="text-type"
          v-model="textValue"
          label="Text Input"
          type="text"
          placeholder="Enter text"
        />
        <FormInput
          id="number-type"
          v-model="numberValue"
          label="Number Input"
          type="number"
          :min="0"
          :max="100"
        />
        <FormInput
          id="password-type"
          v-model="passwordValue"
          label="Password Input"
          type="password"
        />
        <FormInput
          id="email-type"
          v-model="emailValue"
          label="Email Input"
          type="email"
          placeholder="user@example.com"
        />
      </div>
    `,
  }),
};

/**
 * Form layout with multiple required fields.
 */
export const FormLayout: Story = {
  render: () => ({
    components: { FormInput },
    setup() {
      const deviceName = ref('');
      const apiKey = ref('');
      const brightness = ref(100);
      return { deviceName, apiKey, brightness };
    },
    template: `
      <div style="max-width: 340px;">
        <h3 style="color: #fff; margin: 0 0 16px; font-size: 16px;">Device Configuration</h3>
        <FormInput
          id="device-name"
          v-model="deviceName"
          label="Device Name"
          placeholder="Living Room Light"
          required
        />
        <FormInput
          id="api-key"
          v-model="apiKey"
          label="API Key"
          type="password"
          placeholder="Enter your API key"
          required
          help-text="Required for device communication"
        />
        <FormInput
          id="default-brightness"
          v-model="brightness"
          label="Default Brightness"
          type="number"
          :min="1"
          :max="100"
          :step="5"
          help-text="Initial brightness when turning on (1-100%)"
        />
      </div>
    `,
  }),
};
