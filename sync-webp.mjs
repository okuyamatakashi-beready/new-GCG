import sharp from 'sharp';
import chokidar from 'chokidar';
import { readdir, stat, mkdir, unlink } from 'fs/promises';
import path from 'path';

const IMAGES_DIR = 'assets/images';
const WEBP_DIR = 'assets/images/webp';

async function ensureDir() {
  await mkdir(WEBP_DIR, { recursive: true });
}

function webpPathFor(pngFile) {
  const base = path.basename(pngFile).replace(/\.png$/i, '.webp');
  return path.join(WEBP_DIR, base);
}

async function convertOne(pngPath, { force = false } = {}) {
  const webpPath = webpPathFor(pngPath);
  const pngInfo = await stat(pngPath);

  if (!force) {
    try {
      const webpInfo = await stat(webpPath);
      if (pngInfo.mtimeMs <= webpInfo.mtimeMs) return null;
    } catch {
      // WebP doesn't exist → 変換する
    }
  }

  try {
    await sharp(pngPath).webp({ quality: 80 }).toFile(webpPath);
    const webpInfo = await stat(webpPath);
    return {
      name: path.basename(pngPath),
      pngSize: pngInfo.size,
      webpSize: webpInfo.size,
    };
  } catch (e) {
    console.error(`skip: ${path.basename(pngPath)} (${e.message})`);
    return null;
  }
}

async function syncAll() {
  await ensureDir();
  const files = await readdir(IMAGES_DIR);
  const pngFiles = files.filter(f => /\.png$/i.test(f));

  let updated = 0;
  for (const file of pngFiles) {
    const result = await convertOne(path.join(IMAGES_DIR, file));
    if (result) {
      console.log(`${result.name} → ${result.name.replace(/\.png$/i, '.webp')} (${fmt(result.pngSize)} → ${fmt(result.webpSize)})`);
      updated++;
    }
  }
  if (updated === 0) console.log('All WebP files are up to date.');
  else console.log(`\n${updated} file(s) updated.`);
}

async function watch() {
  await ensureDir();
  await syncAll();

  console.log(`\n👀 watching ${IMAGES_DIR}/*.png ... (Ctrl+C で終了)`);

  const watcher = chokidar.watch(`${IMAGES_DIR}/*.png`, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  });

  const handleChange = async (pngPath) => {
    const result = await convertOne(pngPath, { force: true });
    if (result) {
      const time = new Date().toLocaleTimeString('ja-JP');
      console.log(`[${time}] ${result.name} → .webp (${fmt(result.pngSize)} → ${fmt(result.webpSize)})`);
    }
  };

  const handleUnlink = async (pngPath) => {
    const webpPath = webpPathFor(pngPath);
    try {
      await unlink(webpPath);
      const time = new Date().toLocaleTimeString('ja-JP');
      console.log(`[${time}] 削除: ${path.basename(webpPath)}`);
    } catch {
      // WebPが元々無い場合は無視
    }
  };

  watcher
    .on('add', handleChange)
    .on('change', handleChange)
    .on('unlink', handleUnlink);
}

function fmt(bytes) {
  if (bytes > 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + 'MB';
  return (bytes / 1024).toFixed(0) + 'KB';
}

const isWatch = process.argv.includes('--watch');
(isWatch ? watch() : syncAll()).catch(console.error);
