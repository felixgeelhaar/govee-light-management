import { createApp } from "vue";
import App from "./App.vue";
import WarmthActionView from "./views/WarmthActionView.vue";
import { initializePropertyInspector } from "./utils/propertyInspectorInit";

// Initialize Property Inspector WebSocket connection
initializePropertyInspector();

// Create and mount the Vue application for Warmth Action Property Inspector
const app = createApp(App);

// Add the warmth action view as the main content
app.component("main-view", WarmthActionView);

// Mount the app with the specific view
app.mount("#app");