import { copyFile } from 'node:fs/promises';

// GitHub Pages falls back to 404.html for any path it does not recognize.
await copyFile(new URL('../dist/index.html', import.meta.url), new URL('../dist/404.html', import.meta.url));
console.log('copied dist/index.html → dist/404.html');
