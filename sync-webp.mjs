import sharp from 'sharp';
import { readdir, stat, mkdir } from 'fs/promises';
import path from 'path';

const IMAGES_DIR = 'assets/images';
const WEBP_DIR = 'assets/images/webp';

async function syncWebp() {
  await mkdir(WEBP_DIR, { recursive: true });

  const files = await readdir(IMAGES_DIR);
  const pngFiles = files.filter(f => f.endsWith('.png'));

  let updated = 0;

  for (const file of pngFiles) {
    const pngPath = path.join(IMAGES_DIR, file);
    const webpPath = path.join(WEBP_DIR, file.replace('.png', '.webp'));

    const pngInfo = await stat(pngPath);

    let needsUpdate = false;
    try {
      const webpInfo = await stat(webpPath);
      needsUpdate = pngInfo.mtimeMs > webpInfo.mtimeMs;
    } catch {
      needsUpdate = true; // WebP doesn't exist
    }

    if (!needsUpdate) continue;

    try {
      await sharp(pngPath).webp({ quality: 80 }).toFile(webpPath);
      const webpInfo = await stat(webpPath);
      console.log(`${file} → ${file.replace('.png', '.webp')} (${fmt(pngInfo.size)} → ${fmt(webpInfo.size)})`);
      updated++;
    } catch (e) {
      console.error(`skip: ${file} (${e.message})`);
    }
  }

  if (updated === 0) {
    console.log('All WebP files are up to date.');
  } else {
    console.log(`\n${updated} file(s) updated.`);
  }
}

function fmt(bytes) {
  if (bytes > 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + 'MB';
  return (bytes / 1024).toFixed(0) + 'KB';
}

syncWebp().catch(console.error);
