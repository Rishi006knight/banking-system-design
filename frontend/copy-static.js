import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetDir = path.resolve(__dirname, '../gateway/src/main/resources/static');

function copyRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'public' && entry.name !== 'src' && !entry.name.startsWith('.')) {
        copyRecursive(srcPath, destPath);
      }
    } else {
      if (entry.name === 'index.html' || entry.name.endsWith('.js') || entry.name.endsWith('.css') || entry.name.endsWith('.png') || entry.name.endsWith('.svg')) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`Copied: ${entry.name} -> ${destPath}`);
      }
    }
  }
}

console.log(`Copying static assets from ${__dirname} to ${targetDir}...`);
copyRecursive(__dirname, targetDir);
console.log('Static assets synced successfully.');
