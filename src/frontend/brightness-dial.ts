import { createApp } from "vue";
import App from "./App.vue";
import BrightnessDialView from "./views/BrightnessDialView.vue";
import { initializePropertyInspector } from "./utils/propertyInspectorInit";

// Initialize Property Inspector WebSocket connection
initializePropertyInspector();

// Create and mount the Vue application for Brightness Dial Property Inspector
const app = createApp(App);

// Add the brightness dial view as the main content
app.component("main-view", BrightnessDialView);

// Mount the app with the specific view
app.mount("#app");
