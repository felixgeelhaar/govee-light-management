import { createApp } from 'vue'
import App from './App.vue'
import LightControlView from './views/LightControlView.vue'

// Create and mount the Vue application for Light Control Property Inspector
const app = createApp(App)

// Mount the app with the specific view
app.mount('#app')

// Add the light control view as the main content
app.component('main-view', LightControlView)