import { defineConfig } from 'vite'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  // Build as a library for Node.js backend
  build: {
    lib: {
      entry: resolve(__dirname, 'src/backend/plugin.ts'),
      name: 'govee-light-management-plugin',
      fileName: 'plugin',
      formats: ['es']
    },
    outDir: 'com.felixgeelhaar.govee-light-management.sdPlugin/bin',
    emptyOutDir: false, // Don't empty the entire bin directory
    
    rollupOptions: {
      // External dependencies that should not be bundled
      external: [
        '@elgato/streamdeck',
        '@felixgeelhaar/govee-api-client'
      ],
      
      output: {
        // Ensure ESM format with proper file extension
        entryFileNames: 'plugin.js',
        format: 'es',
        
        // Custom banner to add package.json for ESM
        banner: '// ESM Module - package.json will be emitted separately'
      },
      
      // Watch additional files that should trigger rebuilds
      watch: {
        include: ['src/backend/**/*.ts', 'com.felixgeelhaar.govee-light-management.sdPlugin/manifest.json']
      }
    },
    
    // Generate sourcemaps in development
    sourcemap: process.env.NODE_ENV === 'development',
    
    // Target Node.js environment
    target: 'node18',
    
    // Minify in production
    minify: process.env.NODE_ENV === 'production'
  },
  
  // Path resolution matching current Rollup setup
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/backend'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  },
  
  // Define environment variables
  define: {
    // Ensure we're building for Node.js
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
  },
  
  // Optimize dependencies for Node.js
  optimizeDeps: {
    // Skip dependency optimization for backend build
    noDiscovery: true,
    include: []
  },
  
  // Custom plugin to emit package.json for ESM support
  plugins: [
    {
      name: 'emit-esm-package-json',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'package.json',
          source: JSON.stringify({ type: 'module' }, null, 2)
        })
      }
    },
    
    // Custom plugin to watch manifest.json
    {
      name: 'watch-stream-deck-manifest',
      buildStart() {
        this.addWatchFile(resolve(__dirname, 'com.felixgeelhaar.govee-light-management.sdPlugin/manifest.json'))
      }
    }
  ]
})