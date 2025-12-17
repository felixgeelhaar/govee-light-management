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
import { ref, computed } from "vue";

const props = withDefaults(
  defineProps<{
    id: string;
    modelValue: string | number;
    label: string;
    type?: string;
    min?: number;
    max?: number;
    step?: number;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    helpText?: string;
    validator?: (value: any) => string | null;
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

const errorMessage = ref<string | null>(null);

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

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement;
  const value = props.type === "number" ? Number(target.value) : target.value;
  emit("update:modelValue", value);

  // Clear error on input (but don't validate until blur)
  if (errorMessage.value) {
    errorMessage.value = null;
  }
}

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
