import { createApp } from "vue";
import App from "./App.vue";
import ColorActionView from "./views/ColorActionView.vue";
import { initializePropertyInspector } from "./utils/propertyInspectorInit";

// Initialize Property Inspector WebSocket connection
initializePropertyInspector();

// Create and mount the Vue application for Color Action Property Inspector
const app = createApp(App);

// Add the color action view as the main content
app.component("main-view", ColorActionView);

// Mount the app with the specific view
app.mount("#app");