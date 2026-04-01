import sharp from 'sharp';
import { readdir, stat, mkdir } from 'fs/promises';
import path from 'path';

const IMAGES_DIR = 'assets/images';
const WEBP_DIR = 'assets/images/webp';

async function optimize() {
  // Create webp directory
  await mkdir(WEBP_DIR, { recursive: true });

  const files = await readdir(IMAGES_DIR);
  const pngFiles = files.filter(f => f.endsWith('.png'));

  let totalOriginal = 0;
  let totalOptimized = 0;
  let totalWebp = 0;

  for (const file of pngFiles) {
    const inputPath = path.join(IMAGES_DIR, file);
    const fileInfo = await stat(inputPath);
    const originalSize = fileInfo.size;
    totalOriginal += originalSize;

    try {
      // Compress PNG (lossy-ish via palette + compression)
      const image = sharp(inputPath);
      const metadata = await image.metadata();

      // PNG optimization
      await sharp(inputPath)
        .png({ quality: 80, compressionLevel: 9, effort: 10 })
        .toFile(inputPath + '.tmp');

      const optimizedInfo = await stat(inputPath + '.tmp');

      // Only replace if smaller
      if (optimizedInfo.size < originalSize) {
        const { rename } = await import('fs/promises');
        await rename(inputPath + '.tmp', inputPath);
        totalOptimized += optimizedInfo.size;
        console.log(`PNG  ${file}: ${fmt(originalSize)} → ${fmt(optimizedInfo.size)} (${pct(originalSize, optimizedInfo.size)})`);
      } else {
        const { unlink } = await import('fs/promises');
        await unlink(inputPath + '.tmp');
        totalOptimized += originalSize;
        console.log(`PNG  ${file}: ${fmt(originalSize)} (skip - already optimal)`);
      }

      // WebP conversion
      const webpPath = path.join(WEBP_DIR, file.replace('.png', '.webp'));
      await sharp(inputPath)
        .webp({ quality: 80 })
        .toFile(webpPath);

      const webpInfo = await stat(webpPath);
      totalWebp += webpInfo.size;
      console.log(`WebP ${file.replace('.png', '.webp')}: ${fmt(webpInfo.size)} (${pct(originalSize, webpInfo.size)})`);
      console.log('');
    } catch (e) {
      console.error(`Error processing ${file}:`, e.message);
      totalOptimized += originalSize;
    }
  }

  // Also handle SVGs (just copy info)
  console.log('='.repeat(60));
  console.log(`Original total:       ${fmt(totalOriginal)}`);
  console.log(`Optimized PNG total:  ${fmt(totalOptimized)} (${pct(totalOriginal, totalOptimized)})`);
  console.log(`WebP total:           ${fmt(totalWebp)} (${pct(totalOriginal, totalWebp)})`);
}

function fmt(bytes) {
  if (bytes > 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + 'MB';
  return (bytes / 1024).toFixed(0) + 'KB';
}

function pct(original, optimized) {
  const saved = ((1 - optimized / original) * 100).toFixed(0);
  return `-${saved}%`;
}

optimize().catch(console.error);
