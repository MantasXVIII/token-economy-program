const fs = require('fs');
const path = require('path');

// Ensure .wrangler/tmp directory exists
const outputDir = path.join(__dirname, '.wrangler/tmp');
fs.mkdirSync(outputDir, { recursive: true });

const htmlContent = fs.readFileSync(path.join(__dirname, 'ui.html'), 'utf8');
fs.writeFileSync(path.join(__dirname, '.wrangler/tmp/ui_html.js'), `export const UI_HTML = ${JSON.stringify(htmlContent)};`);
