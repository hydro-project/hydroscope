#!/usr/bin/env node

/**
 * CJS wrapper to run the existing validateExample.js in ESM projects.
 */
const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, 'validateExample.js');
const code = fs.readFileSync(srcPath, 'utf8');
// eslint-disable-next-line no-eval
eval(code);
