<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="modal-overlay" @click="closeModal">
        <div class="modal-container" @click.stop>
          <div class="modal-header">
            <h3 class="modal-title">{{ title }}</h3>
            <button class="modal-close" @click="closeModal" type="button">
              ✕
            </button>
          </div>

          <div class="modal-body">
            <div v-if="type" class="modal-status" :class="type">
              <span class="modal-status-icon">{{ statusIcon }}</span>
              <div class="modal-status-content">
                <slot>
                  <p>{{ message }}</p>
                </slot>
              </div>
            </div>
            <div v-else>
              <slot>
                <p>{{ message }}</p>
              </slot>
            </div>
          </div>

          <div class="modal-footer">
            <slot name="footer">
              <button class="btn btn-primary" @click="closeModal" type="button">
                OK
              </button>
            </slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
  show: boolean;
  title?: string;
  message?: string;
  type?: "success" | "error" | "warning" | "info";
}

const props = withDefaults(defineProps<Props>(), {
  title: "Information",
  message: "",
  type: undefined,
});

const emit = defineEmits<{
  close: [];
}>();

const statusIcon = computed(() => {
  switch (props.type) {
    case "success":
      return "✅";
    case "error":
      return "❌";
    case "warning":
      return "⚠️";
    case "info":
      return "ℹ️";
    default:
      return "";
  }
});

const closeModal = () => {
  emit("close");
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(2px);
}

.modal-container {
  background: var(--elgato-bg-section);
  border: 1px solid var(--elgato-border);
  border-radius: 8px;
  max-width: 400px;
  width: 90%;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--elgato-border);
  background: var(--elgato-bg-input);
}

.modal-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--elgato-text-primary);
}

.modal-close {
  background: transparent;
  border: none;
  color: var(--elgato-text-secondary);
  cursor: pointer;
  padding: 4px;
  font-size: 18px;
  line-height: 1;
  transition: color 0.15s ease;
  border-radius: 3px;
}

.modal-close:hover {
  color: var(--elgato-text-primary);
  background: var(--elgato-bg-hover);
}

.modal-body {
  padding: 20px;
  color: var(--elgato-text-primary);
}

.modal-status {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 12px;
}

.modal-status.success {
  background: var(--elgato-status-success-bg);
  color: var(--elgato-status-success-text);
}

.modal-status.error {
  background: var(--elgato-status-error-bg);
  color: var(--elgato-status-error-text);
}

.modal-status.warning {
  background: var(--elgato-status-warning-bg);
  color: var(--elgato-status-warning-text);
}

.modal-status.info {
  background: var(--elgato-status-info-bg);
  color: var(--elgato-status-info-text);
}

.modal-status-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.modal-status-content {
  flex: 1;
}

.modal-status-content p {
  margin: 0;
}

.modal-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--elgato-border);
  background: var(--elgato-bg-input);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn {
  padding: 8px 16px;
  border: 1px solid var(--elgato-border);
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s ease;
}

.btn-primary {
  background: var(--elgato-blue);
  color: white;
  border-color: var(--elgato-blue);
}

.btn-primary:hover {
  background: #0066cc;
  border-color: #0066cc;
}

/* Transition */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-20px);
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: all 0.3s ease;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.95) translateY(-20px);
}
</style>
