<template>
  <div class="lazy-load-wrapper">
    <div v-if="!isLoaded" class="loading-placeholder">
      <LoadingSpinner :size="24" />
      <span v-if="loadingText" class="loading-text">{{ loadingText }}</span>
    </div>
    <component v-else :is="component" v-bind="$attrs" v-on="$listeners" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, defineAsyncComponent, type Component } from "vue";
import LoadingSpinner from "./LoadingSpinner.vue";

interface Props {
  loader: () => Promise<Component>;
  loadingText?: string;
  delay?: number;
}

const props = withDefaults(defineProps<Props>(), {
  loadingText: "",
  delay: 0,
});

const isLoaded = ref(false);
const component = ref<Component | null>(null);

onMounted(async () => {
  // Add delay if specified (useful for preventing flicker on fast loads)
  if (props.delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, props.delay));
  }

  try {
    const loadedComponent = await props.loader();
    component.value = loadedComponent;
    isLoaded.value = true;
  } catch (error) {
    console.error("Failed to load component:", error);
  }
});
</script>

<style scoped>
.lazy-load-wrapper {
  min-height: 40px;
}

.loading-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
}

.loading-text {
  color: var(--el-color-text-secondary, #999);
  font-size: 14px;
}
</style>
