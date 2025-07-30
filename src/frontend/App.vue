<template>
  <div class="govee-light-manager">
    <header class="app-header">
      <h1>Govee Light Management</h1>
    </header>
    
    <main class="app-content">
      <slot>
        <!-- Content will be injected here -->
      </slot>
    </main>
  </div>
</template>

<script setup lang="ts">
// Main application component for Govee Light Management Property Inspector
</script>

<style scoped>
.govee-light-manager {
  display: flex;
  flex-direction: column;
  height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: var(--sdpi-color-bg, #1e1e1e);
  color: var(--sdpi-color-text, #cccccc);
}

.app-header {
  padding: 16px;
  border-bottom: 1px solid var(--sdpi-color-border, #333);
}

.app-header h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--sdpi-color-accent, #0099ff);
}

.app-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
</style>