import { createApp, h } from "vue";
import App from "./App.vue";
import MusicModeView from "./views/MusicModeView.vue";
import { initializePropertyInspector } from "./utils/propertyInspectorInit";

// Initialize Property Inspector WebSocket connection
initializePropertyInspector();

// Create and mount the Vue application with App wrapper
const app = createApp({
  render: () => h(App, null, {
    default: () => h(MusicModeView)
  })
});

// Mount the app
app.mount("#app");
