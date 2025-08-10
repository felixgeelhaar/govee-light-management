#!/usr/bin/env node

/**
 * Script to extract common CSS from Vue components and replace with imports
 * This automates the process of CSS deduplication
 */

const fs = require('fs');
const path = require('path');

// List of Vue files to process
const vueFiles = [
  'src/frontend/views/ToggleActionView.vue',
  'src/frontend/views/BrightnessActionView.vue',
  'src/frontend/views/ColorActionView.vue',
  'src/frontend/views/WarmthActionView.vue',
  'src/frontend/views/GroupControlView.vue',
  'src/frontend/views/LightControlView.vue'
];

// Common CSS patterns to remove (these are now in common.css)
const commonStyles = [
  '.status-field',
  '.status-field.info',
  '.status-field.success', 
  '.status-field.error',
  '.status-field.warning',
  '.status-field .status-icon',
  '.status-field .status-text',
  '.config-section',
  '.config-section h2',
  '.form-group',
  '.form-group:last-child',
  '.form-group label',
  '.input-group',
  '.form-input',
  '.form-select',
  '.form-input:focus',
  '.form-select:focus',
  '.form-input:disabled',
  '.form-select:disabled',
  '.help-text',
  '.btn',
  '.btn:disabled',
  '.btn-primary',
  '.btn-primary:hover:not(:disabled)',
  '.btn-secondary',
  '.btn-secondary:hover:not(:disabled)',
  '.btn-icon',
  '.btn-icon:hover:not(:disabled)'
];

function processVueFile(filePath) {
  console.log(`Processing ${filePath}...`);
  
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  let inStyleSection = false;
  let styleStartIndex = -1;
  let resultLines = [];
  let currentBlock = [];
  let blockStartIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.includes('<style scoped>')) {
      inStyleSection = true;
      styleStartIndex = i;
      // Add the style tag with import
      resultLines.push('<style scoped>');
      resultLines.push('@import \'../assets/common.css\';');
      resultLines.push('');
      continue;
    }
    
    if (line.includes('</style>')) {
      inStyleSection = false;
      // Process any remaining block
      if (currentBlock.length > 0) {
        const blockSelector = currentBlock[0].trim();
        if (!isCommonStyle(blockSelector)) {
          resultLines.push(...currentBlock);
        }
        currentBlock = [];
      }
      resultLines.push('</style>');
      continue;
    }
    
    if (inStyleSection) {
      // Check if this is a new CSS rule (starts with . or has {)
      if (line.trim().startsWith('.') || line.includes('{')) {
        // Process previous block if any
        if (currentBlock.length > 0) {
          const blockSelector = currentBlock[0].trim();
          if (!isCommonStyle(blockSelector)) {
            resultLines.push(...currentBlock);
          }
          currentBlock = [];
        }
        // Start new block
        currentBlock = [line];
        blockStartIndex = i;
      } else if (line.trim() === '' && currentBlock.length > 0) {
        // End of current block
        const blockSelector = currentBlock[0].trim();
        if (!isCommonStyle(blockSelector)) {
          resultLines.push(...currentBlock);
          resultLines.push(''); // Add the empty line
        }
        currentBlock = [];
      } else if (currentBlock.length > 0) {
        // Continue current block
        currentBlock.push(line);
      } else if (line.trim() === '') {
        // Empty line outside block
        resultLines.push(line);
      }
    } else {
      resultLines.push(line);
    }
  }
  
  // Write the result back
  fs.writeFileSync(filePath, resultLines.join('\n'));
  console.log(`✅ Updated ${filePath}`);
}

function isCommonStyle(selector) {
  // Remove any leading/trailing whitespace and check if it matches common styles
  const cleanSelector = selector.replace(/\s*{.*$/, '').trim();
  
  return commonStyles.some(commonStyle => {
    return cleanSelector.startsWith(commonStyle);
  });
}

// Process all Vue files
vueFiles.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    try {
      processVueFile(filePath);
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error.message);
    }
  } else {
    console.warn(`⚠️  File not found: ${filePath}`);
  }
});

console.log('🎉 CSS extraction completed!');