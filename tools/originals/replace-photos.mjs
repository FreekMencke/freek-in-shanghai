// Replaces the full-size photos in src/uploads/ with sharper versions made from the camera originals (a Google
// Photos export): the photos WordPress kept were already shrunk to about 1920 px before upload. A photo is replaced
// only when an original has the same file name (or the one in RENAMED or INSTAGRAM), the same aspect ratio and the
// same content (photos cropped in WordPress keep their upload), and gives more pixels. The new file is at most
// MAX_SIZE px on its long side, turned upright and without metadata (the originals carry GPS positions). Keeps the
// file names, so only the widths in the srcset attributes of the pages change. Safe to re-run.
// Usage: node tools/originals/replace-photos.mjs "/mnt/c/Users/freek/Downloads/Photos from 2017"
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SRC = fileURLToPath(new URL('../../src/', import.meta.url));
const UPLOADS = path.join(SRC, 'uploads');
const MAX_SIZE = 2560;
const QUALITY = 85;
// Mean difference (0–255) of the 16 x 16 fingerprints: the same photo scores under 11, a different one over 20.
const MAX_DIFFERENCE = 15;
// Uploads whose original has another name in the export: found by comparing content, then checked by eye.
const RENAMED = {
  '2017/03/IMG_20170308_141632-e1489058297553.jpg': 'IMG_20170308_141632.jpg',
  '2017/03/IMG_20170308_143029-e1489058203154.jpg': 'IMG_20170308_143029.jpg',
  '2017/04/17934048_117765772055554_5892374278875119616_n.jpg': 'IMG_20170419_195534_385.jpg',
  '2017/05/18252679_1708836219145227_6000592564082704384_n.jpg': 'IMG_20170507_125555_392.jpg',
};
// Instagram posts: the centre square of an original, with a filter. Remade from that square without the filter,
// which the content check can't see past, so these skip it.
const INSTAGRAM = {
  '2017/03/17076418_384939298556002_5160741692516597760_n.jpg': 'IMG_20170308_195725.jpg',
  '2017/03/17076938_1429881617023525_7474689953557905408_n.jpg': 'IMG_20170308_204448.jpg',
  '2017/03/17077711_430707013988024_5851715919427928064_n.jpg': 'IMG_20170308_154032.jpg',
};

const originals = process.argv[2];
if (!originals) throw new Error('Usage: node tools/originals/replace-photos.mjs <folder with the originals>');

/** A 16 x 16 grayscale thumbnail of the upright photo, stretched to full contrast. */
async function fingerprint(file) {
  return sharp(file).rotate().resize(16, 16, { fit: 'fill' }).grayscale().normalise().raw().toBuffer();
}

/** Width and height of the photo as shown, after its EXIF orientation. */
async function uprightSize(file) {
  const { width, height, orientation = 1 } = await sharp(file).metadata();
  return orientation >= 5 ? { width: height, height: width } : { width, height };
}

async function replace(file, original, square) {
  const upload = path.join(UPLOADS, file);
  const [current, full] = await Promise.all([uprightSize(upload), uprightSize(original)]);
  const side = Math.min(full.width, full.height);
  const source = square ? { width: side, height: side } : full;
  const ratio = current.width / current.height / (source.width / source.height);
  if (Math.abs(ratio - 1) > 0.01) return { skipped: `other aspect ratio (${source.width} x ${source.height})` };
  if (!square) {
    const [a, b] = await Promise.all([fingerprint(upload), fingerprint(original)]);
    const difference = a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0) / a.length;
    if (difference > MAX_DIFFERENCE) return { skipped: `other content (difference ${difference.toFixed(0)})` };
  }
  const scale = Math.min(1, MAX_SIZE / Math.max(source.width, source.height));
  if (Math.round(source.width * scale) <= current.width) return { skipped: 'not larger' };

  const { data, info } = await sharp(original)
    .rotate()
    .resize(MAX_SIZE, MAX_SIZE, { fit: square ? 'cover' : 'inside', withoutEnlargement: true })
    .jpeg({ quality: QUALITY, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  await writeFile(upload, data);
  return { width: info.width };
}

// Full-size uploads are the files without a WordPress size suffix ("-1024x768").
const uploads = (await readdir(UPLOADS, { recursive: true }))
  .map(f => f.split(path.sep).join('/'))
  .filter(f => /\.jpe?g$/i.test(f) && !/-\d+x\d+\.\w+$/.test(f));
const byName = new Map((await readdir(originals)).map(f => [f.toLowerCase(), path.join(originals, f)]));

const replaced = new Map();
const skipped = [];
let unmatched = 0;
let notLarger = 0;
for (const file of uploads) {
  const name = INSTAGRAM[file] ?? RENAMED[file] ?? path.posix.basename(file);
  const original = byName.get(name.toLowerCase());
  if (!original) {
    unmatched++;
    continue;
  }
  const result = await replace(file, original, file in INSTAGRAM);
  if (result.skipped === 'not larger') notLarger++;
  else if (result.skipped) skipped.push(`${file}: ${result.skipped}`);
  else replaced.set(file, result);
}

// The srcset width of each replaced photo, in the Dutch and English pages.
const pages = (await readdir(SRC, { recursive: true }))
  .filter(f => f.endsWith('.html') && !f.startsWith('uploads'))
  .map(f => path.join(SRC, f));
let widths = 0;
for (const page of pages) {
  const html = await readFile(page, 'utf8');
  const updated = html.replace(/\/uploads\/([^\s"',]+) \d+w/g, (match, file) => {
    const photo = replaced.get(file);
    if (!photo) return match;
    widths++;
    return `/uploads/${file} ${photo.width}w`;
  });
  if (updated !== html) await writeFile(page, updated);
}

console.log(
  `replaced ${replaced.size}, srcset widths updated ${widths}, ` +
    `without an original ${unmatched}, original not larger ${notLarger}`,
);
if (skipped.length) console.log(`kept ${skipped.length}:\n  ${skipped.join('\n  ')}`);
