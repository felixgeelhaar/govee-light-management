import { createApp } from "vue";
import App from "./App.vue";
import ColorTempDialView from "./views/ColorTempDialView.vue";
import { initializePropertyInspector } from "./utils/propertyInspectorInit";

// Initialize Property Inspector WebSocket connection
initializePropertyInspector();

// Create and mount the Vue application for Color Temperature Dial Property Inspector
const app = createApp(App);

// Add the color temperature dial view as the main content
app.component("main-view", ColorTempDialView);

// Mount the app with the specific view
app.mount("#app");
