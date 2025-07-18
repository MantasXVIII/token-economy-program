const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, '.wrangler/tmp');
fs.mkdirSync(outputDir, { recursive: true });

// Copy HTML to ui_html.js
const htmlContent = fs.readFileSync(path.join(__dirname, 'src/client/index.html'), 'utf8');
fs.writeFileSync(path.join(__dirname, 'src/utils/ui_html.js'), `export const UI_HTML = ${JSON.stringify(htmlContent)};`);

// Copy assets to .wrangler/tmp for KV storage
const cssContent = fs.readFileSync(path.join(__dirname, 'src/client/css/styles.css'), 'utf8');
fs.writeFileSync(path.join(__dirname, '.wrangler/tmp/styles.css'), cssContent);

const jsContent = fs.readFileSync(path.join(__dirname, 'src/client/js/app.js'), 'utf8');
fs.writeFileSync(path.join(__dirname, '.wrangler/tmp/app.js'), jsContent);

const tasksContent = fs.readFileSync(path.join(__dirname, 'src/client/data/tasks.json'), 'utf8');
fs.writeFileSync(path.join(__dirname, '.wrangler/tmp/tasks.json'), tasksContent);
