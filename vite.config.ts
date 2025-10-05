import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  
  // Build configuration for Property Inspector
  build: {
    outDir: 'com.felixgeelhaar.govee-light-management.sdPlugin/ui/dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'light-control': resolve(__dirname, 'src/frontend/light-control.html'),
        'group-control': resolve(__dirname, 'src/frontend/group-control.html'),
        'brightness-dial': resolve(__dirname, 'src/frontend/brightness-dial.html'),
        'colortemp-dial': resolve(__dirname, 'src/frontend/colortemp-dial.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    },
    // Generate sourcemaps for development
    sourcemap: true,
    // Target modern browsers (Stream Deck uses Chromium)
    target: 'es2020'
  },
  
  // Development server configuration
  server: {
    port: 3000,
    open: false,
    cors: true
  },
  
  // Path resolution
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/frontend'),
      '@shared': resolve(__dirname, 'src/shared'),
    }
  },

  // Environment variables
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false
  },

  // Test configuration
  test: {
    environment: 'jsdom',
    include: ['src/frontend/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    globals: true
  }
})