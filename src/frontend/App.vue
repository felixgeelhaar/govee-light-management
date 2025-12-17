<template>
  <div class="govee-light-manager">
    <slot>
      <!-- View content will be injected here -->
    </slot>
  </div>
</template>

<script setup lang="ts">
// Main application wrapper for consistent UI across all Property Inspectors
// Stream Deck provides its own header, so we just provide the container
</script>

<style scoped>
.govee-light-manager {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background-color: var(--sdpi-color-bg, #1e1e1e);
  color: var(--sdpi-color-text, #cccccc);
  padding: 16px;
}
</style>
