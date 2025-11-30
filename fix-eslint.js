#!/usr/bin/env node
// Quick fix script for common ESLint issues

const fs = require('fs');
const path = require('path');

const filePath = 'Text_LENGTH_Dashboard.js';

console.log('🔧 Applying quick fixes for common ESLint issues...');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Fix unused error variables
content = content.replace(/catch\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\)\s*\{([^}]*)\}/g, (match, varName, body) => {
  if (body.trim() === '' || body.includes('/* ignore */')) {
    return `catch (_${varName}) {${body}}`;
  }
  return match;
});

// Write back the file
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Quick fixes applied! Run ESLint again to see improvements.');