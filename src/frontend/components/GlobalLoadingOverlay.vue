<template>
  <Transition name="loading-overlay">
    <div v-if="visible" class="loading-overlay">
      <div class="loading-content">
        <LoadingSpinner :size="48" />
        <div class="loading-text">{{ text }}</div>
        <div v-if="progress !== undefined" class="loading-progress">
          <div class="loading-progress-bar">
            <div
              class="loading-progress-fill"
              :style="{ width: `${progress}%` }"
            ></div>
          </div>
          <div class="loading-progress-text">{{ Math.round(progress) }}%</div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import LoadingSpinner from "./LoadingSpinner.vue";

interface Props {
  visible: boolean;
  text?: string;
  progress?: number;
}

withDefaults(defineProps<Props>(), {
  text: "Loading...",
  progress: undefined,
});
</script>

<style scoped>
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.loading-content {
  background: var(--el-color-bg-dark, #1a1a1a);
  border-radius: 12px;
  padding: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.loading-text {
  font-size: 16px;
  color: var(--el-color-text-primary, #f0f0f0);
  margin-top: 8px;
}

.loading-progress {
  width: 200px;
  margin-top: 8px;
}

.loading-progress-bar {
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.loading-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.loading-progress-text {
  text-align: center;
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-color-text-secondary, #999);
}

/* Transitions */
.loading-overlay-enter-active,
.loading-overlay-leave-active {
  transition: opacity 0.3s ease;
}

.loading-overlay-enter-from,
.loading-overlay-leave-to {
  opacity: 0;
}
</style>