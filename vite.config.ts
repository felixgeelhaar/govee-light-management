import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  
  // Set base to relative paths for Stream Deck
  base: './',
  
  // Build configuration for Property Inspector
  build: {
    outDir: 'com.felixgeelhaar.govee-light-management.sdPlugin/ui',
    emptyOutDir: true,
    // Generate sourcemaps for development
    sourcemap: process.env.NODE_ENV !== 'production',
    // Target modern browsers (Stream Deck uses Chromium)
    target: 'es2020',
    // Optimize chunk size
    chunkSizeWarningLimit: 500,
    // Enable minification and tree shaking
    minify: 'esbuild',
    // Compression settings
    reportCompressedSize: true,
    // CSS code splitting
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        'light-control': resolve(__dirname, 'src/frontend/light-control.html'),
        'toggle-action': resolve(__dirname, 'src/frontend/toggle-action.html'),
        'brightness-action': resolve(__dirname, 'src/frontend/brightness-action.html'),
        'color-action': resolve(__dirname, 'src/frontend/color-action.html'),
        'warmth-action': resolve(__dirname, 'src/frontend/warmth-action.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          // Place HTML files in root, others with extensions
          if (assetInfo.name?.endsWith('.html')) {
            return '[name].[ext]';
          }
          return '[name].[ext]';
        },
        // Manual chunks for better code splitting
        manualChunks(id) {
          // Vendor chunk for core dependencies
          if (id.includes('node_modules')) {
            if (id.includes('vue') || id.includes('@vue')) {
              return 'vue-vendor';
            }
            if (id.includes('xstate') || id.includes('@xstate')) {
              return 'xstate-vendor';
            }
            return 'vendor';
          }
          // Feedback system chunk
          if (id.includes('/components/Feedback') || 
              id.includes('/components/Toast') ||
              id.includes('/components/GlobalLoading') ||
              id.includes('/components/SuccessAnimation')) {
            return 'feedback';
          }
          // Monitoring chunk
          if (id.includes('Dashboard') || id.includes('Monitoring')) {
            return 'monitoring';
          }
        }
      },
      // Tree shaking optimizations
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false
      }
    }
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
  
  // Optimize dependency pre-bundling
  optimizeDeps: {
    include: [
      'vue',
      '@xstate/vue',
      'xstate'
    ],
    exclude: ['@elgato/streamdeck']
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