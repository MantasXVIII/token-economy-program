const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src', 'client', 'data');
const tmpDir = path.join(__dirname, '.wrangler', 'tmp');

if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

// Copy tasks.json
const tasksSource = path.join(srcDir, 'tasks.json');
const tasksDest = path.join(tmpDir, 'tasks.json');
if (fs.existsSync(tasksSource)) {
  fs.copyFileSync(tasksSource, tasksDest);
  console.log('Copied tasks.json to .wrangler/tmp');
} else {
  console.error('tasks.json not found in src/client/data');
}

// Copy target.json
const targetSource = path.join(srcDir, 'target.json');
const targetDest = path.join(tmpDir, 'target.json');
if (fs.existsSync(targetSource)) {
  fs.copyFileSync(targetSource, targetDest);
  console.log('Copied target.json to .wrangler/tmp');
} else {
  console.error('target.json not found in src/client/data');
}

// Copy other static files (if any)
const staticFiles = ['index.html', 'css/styles.css', 'js/app.js'];
staticFiles.forEach(file => {
  const source = path.join(__dirname, 'src', 'client', file);
  const dest = path.join(tmpDir, file);
  if (fs.existsSync(source)) {
    fs.copyFileSync(source, dest);
    console.log(`Copied ${file} to .wrangler/tmp`);
  } else {
    console.error(`${file} not found in src/client`);
  }
});
