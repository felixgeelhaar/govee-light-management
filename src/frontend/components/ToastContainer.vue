<template>
  <Transition name="toast-container">
    <div v-if="toasts.length > 0" class="toast-container" :data-toast-count="toasts.length">
      <TransitionGroup name="toast" tag="div">
        <ToastNotification
          v-for="toast in toasts"
          :key="toast.id"
          :toast="toast"
          :is-paused="pausedToasts.has(toast.id)"
          @dismiss="$emit('dismiss', toast.id)"
          @pause="$emit('pause', toast.id)"
          @resume="$emit('resume', toast.id)"
          @action="(action) => $emit('action', action, toast.id)"
          @click="$emit('click', toast)"
        />
      </TransitionGroup>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import ToastNotification, { type Toast } from "./ToastNotification.vue";

interface Props {
  toasts: Toast[];
  pausedToasts: Set<string>;
}

defineProps<Props>();

defineEmits<{
  dismiss: [id: string];
  pause: [id: string];
  resume: [id: string];
  action: [action: any, id: string];
  click: [toast: Toast];
}>();
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9998;
  max-width: 420px;
  pointer-events: none;
}

.toast-container > * {
  pointer-events: auto;
}

/* Container transition */
.toast-container-enter-active,
.toast-container-leave-active {
  transition: opacity 0.3s ease;
}

.toast-container-enter-from,
.toast-container-leave-to {
  opacity: 0;
}

/* Individual toast transitions */
:deep(.toast-enter-active) {
  transition: all 0.3s ease;
}

:deep(.toast-leave-active) {
  transition: all 0.3s ease;
  position: absolute;
  right: 0;
}

:deep(.toast-enter-from) {
  transform: translateX(100%);
  opacity: 0;
}

:deep(.toast-leave-to) {
  transform: translateX(100%);
  opacity: 0;
}

:deep(.toast-move) {
  transition: transform 0.3s ease;
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .toast-container {
    top: 10px;
    right: 10px;
    left: 10px;
    max-width: none;
  }
}
</style>