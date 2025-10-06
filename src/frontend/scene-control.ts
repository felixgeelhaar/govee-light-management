import { createApp } from "vue";
import App from "./App.vue";
import SceneControlView from "./views/SceneControlView.vue";
import { initializePropertyInspector } from "./utils/propertyInspectorInit";

// Initialize Property Inspector WebSocket connection
initializePropertyInspector();

// Create and mount the Vue application for Scene Control Property Inspector
const app = createApp(App);

// Add the scene control view as the main content
app.component("main-view", SceneControlView);

// Mount the app with the specific view
app.mount("#app");
