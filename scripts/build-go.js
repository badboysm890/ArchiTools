const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Ensure the resources directory exists
const resourcesDir = path.join(__dirname, '../resources');
if (!fs.existsSync(resourcesDir)) {
  fs.mkdirSync(resourcesDir, { recursive: true });
}

// Build the Go binary
console.log('Building Go server...');
try {
  execSync('go build -o ../resources/filemanager', {
    cwd: path.join(__dirname, '../server'),
    stdio: 'inherit'
  });
  console.log('Go server built successfully!');
} catch (error) {
  console.error('Failed to build Go server:', error);
  process.exit(1);
} 