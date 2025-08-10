<template>
  <div class="govee-light-manager">
    <header class="app-header">
      <h1>Govee Light Management</h1>
    </header>

    <main class="app-content">
      <main-view />
    </main>

    <!-- Global feedback system -->
    <FeedbackSystem ref="feedbackSystem" />
  </div>
</template>

<script setup lang="ts">
import { ref, provide, defineAsyncComponent } from "vue";

// Lazy load the FeedbackSystem for better initial load performance
const FeedbackSystem = defineAsyncComponent({
  loader: () => import("./components/FeedbackSystem.vue"),
  loadingComponent: undefined, // No loading component needed as it's not visible initially
  delay: 200, // Delay before showing loading component
  timeout: 30000, // Timeout after 30 seconds
  onError(error, retry, fail) {
    console.error("Failed to load FeedbackSystem:", error);
    fail();
  },
});

// Main application component for Govee Light Management Property Inspector
const feedbackSystem = ref<InstanceType<typeof FeedbackSystem>>();

// Provide feedback system to all child components
provide("feedbackSystem", feedbackSystem);
</script>

<style scoped>
.govee-light-manager {
  display: flex;
  flex-direction: column;
  height: 100vh;
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background-color: var(--sdpi-color-bg, #1e1e1e);
  color: var(--sdpi-color-text, #cccccc);
}

.app-header {
  padding: 8px 12px;
  border-bottom: 1px solid var(--sdpi-color-border, #333);
  background: var(--sdpi-color-bg-secondary, #2d2d30);
}

.app-header h1 {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--sdpi-color-accent, #0099ff);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.app-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}
</style>
