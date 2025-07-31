import { createApp } from "vue";
import App from "./App.vue";
import GroupControlView from "./views/GroupControlView.vue";
import { initializePropertyInspector } from "./utils/propertyInspectorInit";

// Initialize Property Inspector WebSocket connection
initializePropertyInspector();

// Create and mount the Vue application for Group Control Property Inspector
const app = createApp(App);

// Add the group control view as the main content
app.component("main-view", GroupControlView);

// Mount the app with the specific view
app.mount("#app");
