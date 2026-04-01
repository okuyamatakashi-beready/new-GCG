import { readFileSync, writeFileSync, statSync, existsSync } from 'fs';

const htmlPath = 'index.html';
let html = readFileSync(htmlPath, 'utf-8');

// Find all <img> with .png src that are NOT already inside <picture>
// We'll process line by line for simplicity

const lines = html.split('\n');
const result = [];
let insidePicture = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  if (line.includes('<picture')) insidePicture = true;
  if (line.includes('</picture>')) {
    insidePicture = false;
    result.push(line);
    continue;
  }

  // Handle <source> inside existing <picture> - add WebP source before it
  if (insidePicture && line.includes('<source') && line.includes('.png')) {
    const srcMatch = line.match(/srcset="([^"]+\.png)"/);
    if (srcMatch) {
      const pngPath = srcMatch[1];
      const webpPath = pngPath.replace('assets/images/', 'assets/images/webp/').replace('.png', '.webp');
      const mediaMatch = line.match(/media="([^"]+)"/);
      const media = mediaMatch ? ` media="${mediaMatch[1]}"` : '';

      if (existsSync(webpPath)) {
        const indent = line.match(/^(\s*)/)[1];
        result.push(`${indent}<source srcset="${webpPath}"${media} type="image/webp">`);
        result.push(`${indent}<source srcset="${pngPath}"${media}>`);
        continue;
      }
    }
    result.push(line);
    continue;
  }

  // Handle <img> inside existing <picture> - add WebP source for the default
  if (insidePicture && line.includes('<img') && line.includes('.png')) {
    const srcMatch = line.match(/src="([^"]+\.png)"/);
    if (srcMatch) {
      const pngPath = srcMatch[1];
      const webpPath = pngPath.replace('assets/images/', 'assets/images/webp/').replace('.png', '.webp');
      if (existsSync(webpPath)) {
        const indent = line.match(/^(\s*)/)[1];
        // Add WebP source for default (no media query = PC)
        result.push(`${indent}<source srcset="${webpPath}" type="image/webp">`);
      }
    }
    result.push(line);
    continue;
  }

  // Skip SVGs and non-PNG images
  if (!line.includes('.png') || !line.includes('<img') || insidePicture) {
    result.push(line);
    continue;
  }

  // Extract img attributes
  const srcMatch = line.match(/src="([^"]+\.png)"/);
  if (!srcMatch) {
    result.push(line);
    continue;
  }

  const pngPath = srcMatch[1];
  const webpPath = pngPath.replace('assets/images/', 'assets/images/webp/').replace('.png', '.webp');

  // Check if WebP exists and is actually smaller
  if (!existsSync(webpPath)) {
    result.push(line);
    continue;
  }

  const pngSize = statSync(pngPath).size;
  const webpSize = statSync(webpPath).size;

  if (webpSize >= pngSize) {
    // WebP is larger, skip conversion
    result.push(line);
    continue;
  }

  // Wrap in <picture>
  const indent = line.match(/^(\s*)/)[1];
  const imgTag = line.trim();

  result.push(`${indent}<picture>`);
  result.push(`${indent}    <source srcset="${webpPath}" type="image/webp">`);
  result.push(`${indent}    ${imgTag}`);
  result.push(`${indent}</picture>`);
}

writeFileSync(htmlPath, result.join('\n'));
console.log('Done! HTML updated with <picture> elements.');
