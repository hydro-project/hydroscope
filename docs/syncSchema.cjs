#!/usr/bin/env node

/**
 * CJS wrapper to run the existing syncSchema.js in ESM projects.
 * If syncSchema.js uses require, keep logic here; otherwise, you can migrate it.
 */
const fs = require('fs');
const path = require('path');

// Read the original JS and eval in CJS context
const srcPath = path.join(__dirname, 'syncSchema.js');
const code = fs.readFileSync(srcPath, 'utf8');
// eslint-disable-next-line no-eval
eval(code);
