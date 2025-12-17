<template>
  <div class="form-group">
    <label :for="id" class="form-label">
      {{ label }}
      <span v-if="required" class="required-indicator" aria-label="required"
        >*</span
      >
    </label>

    <input
      :id="id"
      :value="modelValue"
      :type="type"
      :min="min"
      :max="max"
      :step="step"
      :placeholder="placeholder"
      :disabled="disabled"
      :aria-invalid="!!errorMessage"
      :aria-describedby="getAriaDescribedBy"
      :aria-required="required"
      class="form-input"
      :class="{ 'form-input--error': !!errorMessage }"
      @input="handleInput"
      @blur="validate"
    />

    <div
      v-if="errorMessage"
      :id="`${id}-error`"
      class="error-message"
      role="alert"
    >
      <span class="error-icon" aria-hidden="true">⚠️</span>
      {{ errorMessage }}
    </div>

    <small v-if="helpText" :id="`${id}-help`" class="help-text">
      {{ helpText }}
    </small>
  </div>
</template>

<script setup lang="ts">
/**
 * FormInput Component
 *
 * A reusable form input component with built-in validation, accessibility features,
 * and consistent styling for Stream Deck Property Inspectors.
 *
 * Features:
 * - Built-in validation for required fields and number ranges
 * - Custom validator support for complex validation logic
 * - Accessible with proper ARIA attributes and error announcements
 * - Consistent styling with SDPI design tokens
 *
 * @example
 * ```vue
 * <FormInput
 *   id="brightness"
 *   v-model="brightness"
 *   label="Brightness"
 *   type="number"
 *   :min="0"
 *   :max="100"
 *   :required="true"
 *   help-text="Set brightness level (0-100%)"
 * />
 * ```
 *
 * @example Custom Validator
 * ```vue
 * <FormInput
 *   id="apiKey"
 *   v-model="apiKey"
 *   label="API Key"
 *   :validator="(val) => val.length < 32 ? 'API key must be 32+ characters' : null"
 * />
 * ```
 */
import { ref, computed } from "vue";

/**
 * Component props
 */
const props = withDefaults(
  defineProps<{
    /** Unique identifier for the input element */
    id: string;
    /** Current value (v-model binding) */
    modelValue: string | number;
    /** Label text displayed above the input */
    label: string;
    /** HTML input type (text, number, password, etc.) */
    type?: string;
    /** Minimum value for number inputs */
    min?: number;
    /** Maximum value for number inputs */
    max?: number;
    /** Step increment for number inputs */
    step?: number;
    /** Placeholder text when input is empty */
    placeholder?: string;
    /** Whether the input is disabled */
    disabled?: boolean;
    /** Whether the field is required */
    required?: boolean;
    /** Help text displayed below the input */
    helpText?: string;
    /** Custom validation function returning error message or null */
    validator?: (value: string | number) => string | null;
  }>(),
  {
    type: "text",
    disabled: false,
    required: false,
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: string | number): void;
}>();

/** Current validation error message, null when valid */
const errorMessage = ref<string | null>(null);

/**
 * Computes the aria-describedby attribute value
 * Combines error and help text IDs for screen reader accessibility
 */
const getAriaDescribedBy = computed(() => {
  const describedBy: string[] = [];
  if (errorMessage.value) {
    describedBy.push(`${props.id}-error`);
  }
  if (props.helpText) {
    describedBy.push(`${props.id}-help`);
  }
  return describedBy.length > 0 ? describedBy.join(" ") : undefined;
});

/**
 * Handles input changes and emits the new value
 * Clears validation errors on input (re-validates on blur)
 * @param event - The input event
 */
function handleInput(event: Event) {
  const target = event.target as HTMLInputElement;
  const value = props.type === "number" ? Number(target.value) : target.value;
  emit("update:modelValue", value);

  // Clear error on input (but don't validate until blur)
  if (errorMessage.value) {
    errorMessage.value = null;
  }
}

/**
 * Validates the current input value
 * Checks custom validator first, then required field, then number ranges
 */
function validate() {
  // Custom validator takes precedence
  if (props.validator) {
    errorMessage.value = props.validator(props.modelValue);
    return;
  }

  // Required field validation
  if (props.required && !props.modelValue && props.modelValue !== 0) {
    errorMessage.value = "This field is required";
    return;
  }

  // Number range validation
  if (props.type === "number") {
    const num = Number(props.modelValue);

    if (isNaN(num)) {
      errorMessage.value = "Please enter a valid number";
      return;
    }

    if (props.min !== undefined && num < props.min) {
      errorMessage.value = `Minimum value is ${props.min}`;
      return;
    }

    if (props.max !== undefined && num > props.max) {
      errorMessage.value = `Maximum value is ${props.max}`;
      return;
    }
  }

  // All validations passed
  errorMessage.value = null;
}

// Expose validate method for parent components
defineExpose({
  validate,
  hasError: computed(() => !!errorMessage.value),
});
</script>

<style scoped>
.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--sdpi-color-text-primary, #ffffff);
  display: flex;
  align-items: center;
  gap: 4px;
}

.required-indicator {
  color: var(--sdpi-color-danger, #ff4d4f);
  font-weight: 600;
}

.form-input {
  padding: 8px 12px;
  border: 1px solid var(--sdpi-color-border, #333);
  border-radius: 4px;
  background-color: var(--sdpi-color-bg-primary, #1e1e1e);
  color: var(--sdpi-color-text-primary, #ffffff);
  font-size: 14px;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.form-input:focus {
  outline: 2px solid var(--sdpi-color-accent, #0099ff);
  outline-offset: 2px;
  border-color: var(--sdpi-color-accent, #0099ff);
}

.form-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.form-input::placeholder {
  color: var(--sdpi-color-text-secondary, #999);
}

.form-input--error {
  border-color: var(--sdpi-color-border-error, #dc3545);
}

.form-input--error:focus {
  outline-color: var(--sdpi-color-border-error, #dc3545);
  border-color: var(--sdpi-color-border-error, #dc3545);
}

.error-message {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--sdpi-color-text-error, #ff7979);
  font-size: 12px;
  line-height: 1.4;
  padding: 4px 0;
}

.error-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.help-text {
  font-size: 12px;
  color: var(--sdpi-color-text-secondary, #999);
  line-height: 1.4;
}
</style>
