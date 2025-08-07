import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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