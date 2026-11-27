import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const outDir = new URL('../public/icons/', import.meta.url);
await mkdir(outDir, { recursive: true });

const icons = [
  ['icon.svg', 'icon-192.png', 192],
  ['icon.svg', 'icon-512.png', 512],
  ['maskable.svg', 'maskable-512.png', 512],
  ['icon.svg', 'apple-touch-icon.png', 180],
];

for (const [source, name, size] of icons) {
  await sharp(fileURLToPath(new URL(`../public/${source}`, import.meta.url)))
    .resize(size, size)
    .png()
    .toFile(fileURLToPath(new URL(name, outDir)));
  console.log(`generated ${name} (${size}x${size})`);
}
