import { createApp } from "vue";
import App from "./App.vue";
import SegmentColorDialView from "./views/SegmentColorDialView.vue";
import { initializePropertyInspector } from "./utils/propertyInspectorInit";

// Initialize Property Inspector WebSocket connection
initializePropertyInspector();

// Create and mount the Vue application for Segment Color Dial Property Inspector
const app = createApp(App);

// Add the segment color dial view as the main content
app.component("main-view", SegmentColorDialView);

// Mount the app with the specific view
app.mount("#app");
