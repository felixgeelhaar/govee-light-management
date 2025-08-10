<template>
  <div
    :class="[
      'toast',
      `toast-${toast.type}`,
      {
        'toast-persistent': toast.persistent,
        'toast-paused': isPaused,
      },
    ]"
    :role="'alert'"
    :aria-live="toast.type === 'error' ? 'assertive' : 'polite'"
    :aria-atomic="true"
    :aria-labelledby="`toast-title-${toast.id}`"
    :aria-describedby="toast.message ? `toast-message-${toast.id}` : undefined"
    :tabindex="0"
    @click="handleClick"
    @keydown="handleKeydown"
    @mouseenter="$emit('pause')"
    @mouseleave="$emit('resume')"
  >
    <ToastIcon :type="toast.type" />
    
    <div class="toast-content">
      <div :id="`toast-title-${toast.id}`" class="toast-title">
        {{ toast.title }}
      </div>
      <div v-if="toast.message" :id="`toast-message-${toast.id}`" class="toast-message">
        {{ toast.message }}
      </div>
      <div v-if="toast.actions" class="toast-actions">
        <button
          v-for="action in toast.actions"
          :key="action.label"
          :class="[
            'toast-action',
            `toast-action-${action.type || 'primary'}`,
          ]"
          @click.stop="handleAction(action)"
        >
          {{ action.label }}
        </button>
      </div>
    </div>
    
    <button
      v-if="!toast.persistent"
      class="toast-close"
      :aria-label="'Dismiss notification'"
      @click.stop="$emit('dismiss')"
    >
      <svg viewBox="0 0 24 24" class="close-icon">
        <path
          d="M18 6L6 18M6 6l12 12"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          fill="none"
        />
      </svg>
    </button>
    
    <!-- Auto-dismiss progress indicator -->
    <div v-if="!toast.persistent && toast.progress !== undefined" class="toast-progress">
      <div
        class="toast-progress-bar"
        :style="{
          width: `${toast.progress}%`,
          backgroundColor: progressColor,
        }"
      ></div>
    </div>
    
    <!-- Pause indicator -->
    <div v-if="isPaused" class="toast-pause-indicator" :aria-hidden="true">
      ⏸
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import ToastIcon from "./ToastIcon.vue";

export interface ToastAction {
  label: string;
  action: () => void | Promise<void>;
  type?: "primary" | "secondary" | "danger";
}

export interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message?: string;
  duration?: number;
  persistent?: boolean;
  actions?: ToastAction[];
  progress?: number;
}

interface Props {
  toast: Toast;
  isPaused: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  dismiss: [];
  pause: [];
  resume: [];
  action: [action: ToastAction];
  click: [];
}>();

const progressColor = computed(() => {
  const colors = {
    success: "#10b981",
    error: "#ef4444",
    warning: "#f59e0b",
    info: "#3b82f6",
  };
  return colors[props.toast.type];
});

const handleClick = () => {
  emit("click");
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape" && !props.toast.persistent) {
    emit("dismiss");
  } else if (event.key === "Enter" || event.key === " ") {
    emit("click");
  }
};

const handleAction = (action: ToastAction) => {
  emit("action", action);
};
</script>

<style scoped>
.toast {
  display: flex;
  align-items: flex-start;
  background: var(--el-color-bg-dark, #1a1a1a);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 12px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -2px rgba(0, 0, 0, 0.05);
  position: relative;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
}

.toast:hover {
  transform: translateX(-4px);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.toast-success {
  border-left: 4px solid #10b981;
}

.toast-error {
  border-left: 4px solid #ef4444;
}

.toast-warning {
  border-left: 4px solid #f59e0b;
}

.toast-info {
  border-left: 4px solid #3b82f6;
}

.toast-persistent {
  cursor: default;
}

.toast-paused {
  animation-play-state: paused !important;
}

.toast-content {
  flex: 1;
  min-width: 0;
}

.toast-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--el-color-text-primary, #f0f0f0);
  margin-bottom: 4px;
}

.toast-message {
  font-size: 13px;
  color: var(--el-color-text-secondary, #999);
  line-height: 1.4;
}

.toast-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.toast-action {
  padding: 4px 12px;
  font-size: 12px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: transparent;
  color: var(--el-color-text-primary, #f0f0f0);
  cursor: pointer;
  transition: all 0.2s ease;
}

.toast-action:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.3);
}

.toast-action-primary {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.toast-action-primary:hover {
  background: #2563eb;
  border-color: #2563eb;
}

.toast-action-danger {
  background: #ef4444;
  border-color: #ef4444;
  color: white;
}

.toast-action-danger:hover {
  background: #dc2626;
  border-color: #dc2626;
}

.toast-close {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 12px;
  border-radius: 4px;
  transition: background 0.2s ease;
}

.toast-close:hover {
  background: rgba(255, 255, 255, 0.1);
}

.close-icon {
  width: 16px;
  height: 16px;
  color: var(--el-color-text-secondary, #999);
}

.toast-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: rgba(255, 255, 255, 0.05);
}

.toast-progress-bar {
  height: 100%;
  transition: width 0.1s linear;
}

.toast-pause-indicator {
  position: absolute;
  top: 4px;
  right: 4px;
  font-size: 12px;
  opacity: 0.6;
}
</style>