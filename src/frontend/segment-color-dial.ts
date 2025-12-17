import { createApp, h } from "vue";
import App from "./App.vue";
import SegmentColorDialView from "./views/SegmentColorDialView.vue";
import { initializePropertyInspector } from "./utils/propertyInspectorInit";

// Initialize Property Inspector WebSocket connection
initializePropertyInspector();

// Create and mount the Vue application with App wrapper
const app = createApp({
  render: () =>
    h(App, null, {
      default: () => h(SegmentColorDialView),
    }),
});

// Mount the app
app.mount("#app");
