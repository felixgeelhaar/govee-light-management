import { createApp } from "vue";
import App from "./App.vue";
import MusicModeView from "./views/MusicModeView.vue";
import { initializePropertyInspector } from "./utils/propertyInspectorInit";

// Initialize Property Inspector WebSocket connection
initializePropertyInspector();

// Create and mount the Vue application for Music Mode Property Inspector
const app = createApp(App);

// Add the music mode view as the main content
app.component("main-view", MusicModeView);

// Mount the app with the specific view
app.mount("#app");
