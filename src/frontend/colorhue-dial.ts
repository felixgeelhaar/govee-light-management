import { createApp } from "vue";
import App from "./App.vue";
import ColorHueDialView from "./views/ColorHueDialView.vue";
import { initializePropertyInspector } from "./utils/propertyInspectorInit";

// Initialize Property Inspector WebSocket connection
initializePropertyInspector();

// Create and mount the Vue application for Color Hue Dial Property Inspector
const app = createApp(App);

// Add the color hue dial view as the main content
app.component("main-view", ColorHueDialView);

// Mount the app with the specific view
app.mount("#app");
