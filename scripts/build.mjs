// Copies public/ to dist/ and fills in deploy-time values:
//   __SITE_URL__      -> Netlify's URL env var (your custom domain once it is set)
//   __META_PIXEL_ID__ -> META_PIXEL_ID env var; pixel blocks are removed when it is empty
//   __V__             -> short build id, used as ?v= cache buster on assets
import { cp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'public');
const OUT = join(ROOT, 'dist');

const SITE_URL = (process.env.SITE_URL || process.env.URL || 'http://localhost:8888').replace(/\/+$/, '');
const PIXEL_ID = (process.env.META_PIXEL_ID || '').replace(/\D/g, '');
const VERSION = (process.env.COMMIT_REF || Date.now().toString(36)).slice(0, 8);

const TEXT_EXT = new Set(['.html', '.xml', '.txt', '.webmanifest', '.json', '.js', '.css']);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else yield p;
  }
}

await rm(OUT, { recursive: true, force: true });
await cp(SRC, OUT, { recursive: true });

let touched = 0;
for await (const file of walk(OUT)) {
  if (!TEXT_EXT.has(extname(file))) continue;
  let text = await readFile(file, 'utf8');
  const before = text;
  if (!PIXEL_ID) text = text.replace(/<!--pixel:start-->[\s\S]*?<!--pixel:end-->\s*/g, '');
  text = text
    .replaceAll('__SITE_URL__', SITE_URL)
    .replaceAll('__META_PIXEL_ID__', PIXEL_ID)
    .replaceAll('__V__', VERSION);
  if (text !== before) { await writeFile(file, text); touched++; }
}

console.log(`Built dist/ — site ${SITE_URL}, pixel ${PIXEL_ID ? 'on (' + PIXEL_ID + ')' : 'off'}, v=${VERSION}, ${touched} files updated`);
