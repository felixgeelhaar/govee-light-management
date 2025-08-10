import { createApp } from "vue";
import App from "./App.vue";
import BrightnessActionView from "./views/BrightnessActionView.vue";
import { initializePropertyInspector } from "./utils/propertyInspectorInit";

// Initialize Property Inspector WebSocket connection
initializePropertyInspector();

// Create and mount the Vue application for Brightness Action Property Inspector
const app = createApp(App);

// Add the brightness action view as the main content
app.component("main-view", BrightnessActionView);

// Mount the app with the specific view
app.mount("#app");