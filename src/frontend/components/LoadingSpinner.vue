<template>
  <div
    :class="['loading-spinner', `loading-spinner-${variant}`]"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <svg class="spinner-svg" viewBox="0 0 50 50" :width="size" :height="size">
      <circle
        class="spinner-circle"
        cx="25"
        cy="25"
        r="20"
        fill="none"
        :stroke-width="strokeWidth"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
interface Props {
  size?: number;
  variant?: "primary" | "secondary" | "light" | "dark";
  strokeWidth?: number;
}

withDefaults(defineProps<Props>(), {
  size: 32,
  variant: "primary",
  strokeWidth: 3,
});
</script>

<style scoped>
.loading-spinner {
  display: inline-block;
  animation: spin 1s linear infinite;
}

.spinner-svg {
  display: block;
}

.spinner-circle {
  stroke-linecap: round;
  stroke-dasharray: 126;
  stroke-dashoffset: 126;
  animation: dash 1.5s ease-in-out infinite;
}

/* Variant colors */
.loading-spinner-primary .spinner-circle {
  stroke: var(--sdpi-color-accent, #0099ff);
}

.loading-spinner-secondary .spinner-circle {
  stroke: var(--sdpi-color-text-secondary, #999);
}

.loading-spinner-light .spinner-circle {
  stroke: #ffffff;
}

.loading-spinner-dark .spinner-circle {
  stroke: #333333;
}

/* Animations */
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes dash {
  0% {
    stroke-dashoffset: 126;
  }
  50% {
    stroke-dashoffset: 31.5;
  }
  100% {
    stroke-dashoffset: 126;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .loading-spinner {
    animation: none;
  }

  .spinner-circle {
    animation: none;
    stroke-dasharray: none;
    stroke-dashoffset: 0;
  }
}
</style>
