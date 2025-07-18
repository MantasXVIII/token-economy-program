// build.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const outputDir = path.join(__dirname, '.wrangler/tmp');
fs.mkdirSync(outputDir, { recursive: true });

// Generate ui_html.js
const htmlContent = fs.readFileSync(path.join(__dirname, 'src/client/index.html'), 'utf8');
fs.writeFileSync(path.join(__dirname, 'src/utils/ui_html.js'), `export const UI_HTML = ${JSON.stringify(htmlContent)};`);
console.log('Generated ui_html.js');

// Copy and upload CSS
const cssContent = fs.readFileSync(path.join(__dirname, 'src/client/css/styles.css'), 'utf8');
fs.writeFileSync(path.join(__dirname, '.wrangler/tmp/styles.css'), cssContent);
execSync('wrangler kv:key put --binding=GRID_KV styles.css "$(cat .wrangler/tmp/styles.css)"', { stdio: 'inherit' });
console.log('Uploaded styles.css to KV');

// Copy and upload JS
const jsContent = fs.readFileSync(path.join(__dirname, 'src/client/js/app.js'), 'utf8');
fs.writeFileSync(path.join(__dirname, '.wrangler/tmp/app.js'), jsContent);
execSync('wrangler kv:key put --binding=GRID_KV app.js "$(cat .wrangler/tmp/app.js)"', { stdio: 'inherit' });
console.log('Uploaded app.js to KV');

// Copy and upload tasks.json
const tasksContent = fs.readFileSync(path.join(__dirname, 'src/client/data/tasks.json'), 'utf8');
fs.writeFileSync(path.join(__dirname, '.wrangler/tmp/tasks.json'), tasksContent);
execSync('wrangler kv:key put --binding=GRID_KV tasks.json "$(cat .wrangler/tmp/tasks.json)"', { stdio: 'inherit' });
console.log('Uploaded tasks.json to KV');
