import { createApp } from "vue";
import App from "./App.vue";
import ToggleActionView from "./views/ToggleActionView.vue";
import { initializePropertyInspector } from "./utils/propertyInspectorInit";

// Initialize Property Inspector WebSocket connection
initializePropertyInspector();

// Create and mount the Vue application for Toggle Action Property Inspector
const app = createApp(App);

// Add the toggle action view as the main content
app.component("main-view", ToggleActionView);

// Mount the app with the specific view
app.mount("#app");
