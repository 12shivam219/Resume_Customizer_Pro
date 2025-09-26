#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function compressFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!['.js', '.css', '.html', '.json', '.svg'].includes(ext)) return;

  const file = fs.readFileSync(filePath);

  // gzip
  const gz = zlib.gzipSync(file, { level: zlib.constants.Z_BEST_COMPRESSION });
  fs.writeFileSync(filePath + '.gz', gz);

  // brotli
  if (typeof zlib.brotliCompressSync === 'function') {
    const br = zlib.brotliCompressSync(file, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      },
    });
    fs.writeFileSync(filePath + '.br', br);
  }
}

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full);
    else compressFile(full);
  }
}

// Resolve dist/public relative to the current working directory to support running from project root
const dist = path.resolve(process.cwd(), 'dist', 'public');
if (!fs.existsSync(dist)) {
  console.error('dist/public not found. Run build first.');
  process.exit(1);
}
walk(dist);
console.log('Compression complete');
