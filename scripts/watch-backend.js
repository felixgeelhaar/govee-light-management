#!/usr/bin/env node

import { spawn } from 'child_process';
import { watch } from 'chokidar';
import { resolve } from 'path';

const PLUGIN_ID = 'com.felixgeelhaar.govee-light-management';

let viteProcess = null;
let isRestarting = false;

function startViteBuild() {
  if (viteProcess) {
    viteProcess.kill();
  }
  
  console.log('🚀 Starting Vite backend build...');
  
  viteProcess = spawn('npm', ['run', 'build:backend'], {
    stdio: 'inherit',
    shell: true
  });
  
  viteProcess.on('close', (code) => {
    if (code === 0 && !isRestarting) {
      console.log('✅ Backend build completed successfully');
      restartStreamDeck();
    } else if (code !== 0) {
      console.error(`❌ Backend build failed with code ${code}`);
    }
  });
}

function restartStreamDeck() {
  console.log('🔄 Restarting Stream Deck plugin...');
  
  const restartProcess = spawn('streamdeck', ['restart', PLUGIN_ID], {
    stdio: 'inherit',
    shell: true
  });
  
  restartProcess.on('close', (code) => {
    if (code === 0) {
      console.log('🎉 Stream Deck plugin restarted successfully');
    } else {
      console.log('⚠️  Stream Deck restart completed (streamdeck CLI may not be available)');
    }
  });
}

function setupWatcher() {
  const watcher = watch([
    'src/backend/**/*.ts',
    'com.felixgeelhaar.govee-light-management.sdPlugin/manifest.json'
  ], {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true
  });

  watcher.on('change', (path) => {
    if (isRestarting) return;
    
    isRestarting = true;
    console.log(`📝 File changed: ${path}`);
    
    setTimeout(() => {
      startViteBuild();
      isRestarting = false;
    }, 100); // Debounce file changes
  });

  console.log('👀 Watching for backend file changes...');
  return watcher;
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping watch mode...');
  
  if (viteProcess) {
    viteProcess.kill();
  }
  
  process.exit(0);
});

// Start initial build and setup watcher
console.log('🏗️  Starting backend watch mode with Stream Deck integration');
startViteBuild();
setupWatcher();