'use strict';
const { mkdirSync, copyFileSync } = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
mkdirSync(path.join(root, 'public'), { recursive: true });
for (const file of ['index.html', 'styles.css', 'app.js']) copyFileSync(path.join(root, file), path.join(root, 'public', file));
console.log('Prepared public/index.html, styles.css, app.js');
