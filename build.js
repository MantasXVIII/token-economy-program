const fs = require('fs');
const path = require('path');

const htmlContent = fs.readFileSync(path.join(__dirname, 'ui.html'), 'utf8');
fs.writeFileSync(path.join(__dirname, '.wrangler/tmp/ui_html.js'), `export const UI_HTML = ${JSON.stringify(htmlContent)};`);
