<template>
  <div class="toast-icon" :aria-hidden="true">
    <svg viewBox="0 0 24 24" class="icon" :class="`icon-${type}`">
      <path
        v-if="type === 'success'"
        d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        v-else-if="type === 'error'"
        d="M18 6L6 18M6 6l12 12"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        v-else-if="type === 'warning'"
        d="M12 9v4M12 17h.01M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86L7.86 2z"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle
        v-else-if="type === 'info'"
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      />
      <path
        v-if="type === 'info'"
        d="M12 16v-4M12 8h.01"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
interface Props {
  type: 'success' | 'error' | 'warning' | 'info';
}

defineProps<Props>();
</script>

<style scoped>
.toast-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  margin-right: 12px;
}

.icon {
  width: 100%;
  height: 100%;
}

.icon-success {
  color: #10b981;
}

.icon-error {
  color: #ef4444;
}

.icon-warning {
  color: #f59e0b;
}

.icon-info {
  color: #3b82f6;
}
</style>