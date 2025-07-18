// build.js
const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, '.wrangler/tmp');
fs.mkdirSync(outputDir, { recursive: true });

// Generate ui_html.js
const htmlContent = fs.readFileSync(path.join(__dirname, 'src/client/index.html'), 'utf8');
fs.writeFileSync(path.join(__dirname, 'src/utils/ui_html.js'), `export const UI_HTML = ${JSON.stringify(htmlContent)};`);
console.log('Generated ui_html.js');

// Copy CSS
const cssContent = fs.readFileSync(path.join(__dirname, 'src/client/css/styles.css'), 'utf8');
fs.writeFileSync(path.join(__dirname, '.wrangler/tmp/styles.css'), cssContent);
console.log('Copied styles.css');

// Copy JS
const jsContent = fs.readFileSync(path.join(__dirname, 'src/client/js/app.js'), 'utf8');
fs.writeFileSync(path.join(__dirname, '.wrangler/tmp/app.js'), jsContent);
console.log('Copied app.js');

// Copy tasks.json
const tasksContent = fs.readFileSync(path.join(__dirname, 'src/client/data/tasks.json'), 'utf8');
fs.writeFileSync(path.join(__dirname, '.wrangler/tmp/tasks.json'), tasksContent);
console.log('Copied tasks.json');
