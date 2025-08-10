<template>
  <Transition name="success-animation">
    <div v-if="visible" class="success-animation-overlay">
      <div class="success-animation-content">
        <div class="success-checkmark">
          <svg viewBox="0 0 52 52" class="checkmark-svg">
            <circle
              class="checkmark-circle"
              cx="26"
              cy="26"
              r="25"
              fill="none"
            />
            <path
              class="checkmark-check"
              fill="none"
              d="M14.1 27.2l7.1 7.2 16.7-16.8"
            />
          </svg>
        </div>
        <div class="success-message">{{ message }}</div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
interface Props {
  visible: boolean;
  message: string;
}

defineProps<Props>();
</script>

<style scoped>
.success-animation-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.success-animation-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

.success-checkmark {
  width: 100px;
  height: 100px;
}

.checkmark-svg {
  width: 100%;
  height: 100%;
}

.checkmark-circle {
  stroke-dasharray: 166;
  stroke-dashoffset: 166;
  stroke-width: 2;
  stroke-miterlimit: 10;
  stroke: #10b981;
  fill: none;
  animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
}

.checkmark-check {
  transform-origin: 50% 50%;
  stroke-dasharray: 48;
  stroke-dashoffset: 48;
  stroke-width: 3;
  stroke: #10b981;
  animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards;
}

@keyframes stroke {
  100% {
    stroke-dashoffset: 0;
  }
}

.success-message {
  font-size: 24px;
  font-weight: 600;
  color: #fff;
  text-align: center;
  max-width: 400px;
  animation: fadeInUp 0.5s ease 0.8s both;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Transition animations */
.success-animation-enter-active {
  transition: opacity 0.3s ease;
}

.success-animation-leave-active {
  transition: opacity 0.5s ease;
}

.success-animation-enter-from,
.success-animation-leave-to {
  opacity: 0;
}

.success-animation-enter-active .success-animation-content {
  animation: scaleIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

@keyframes scaleIn {
  from {
    transform: scale(0.5);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
