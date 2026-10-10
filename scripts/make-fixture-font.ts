/*
 * Regenerates the fixture font: a woff2 subset of Noto Sans SC Regular (SIL OFL 1.1).
 * Run: pnpm fixture-font   (downloads the pinned source OTF into .cache/ on first use, checks its sha256)
 * Output: test/fixtures/library/fonts/NotoSansSC-Regular.subset.woff2
 * Glyph set: printable ASCII + common Chinese punctuation + every character found in test/fixtures text files.
 * After adding fixture text with new characters, rerun this script and commit the result.
 * The OFL text sits next to the output as OFL.txt; the subset keeps the original name table (copyright, license URL).
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const SOURCE_URL =
  'https://raw.githubusercontent.com/notofonts/noto-cjk/165c01b46ea533872e002e0785ff17e44f6d97d8/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf';
const SOURCE_SHA256 = 'faa6c9df652116dde789d351359f3d7e5d2285a2b2a1f04a2d7244df706d5ea9';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cached = join(root, '.cache', 'src', 'NotoSansSC-Regular.otf');
const fixturesDir = join(root, 'test', 'fixtures');
const output = join(fixturesDir, 'library', 'fonts', 'NotoSansSC-Regular.subset.woff2');

async function loadSource(): Promise<Buffer> {
  if (!existsSync(cached)) {
    const response = await fetch(SOURCE_URL);
    if (!response.ok) throw new Error(`download failed: ${response.status} ${SOURCE_URL}`);
    await mkdir(dirname(cached), { recursive: true });
    await writeFile(cached, Buffer.from(await response.arrayBuffer()));
  }
  const data = await readFile(cached);
  const digest = createHash('sha256').update(data).digest('hex');
  if (digest !== SOURCE_SHA256) throw new Error(`sha256 mismatch for ${cached}: ${digest}`);
  return data;
}

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (/\.(json|liquid|md|html)$/.test(entry.name)) yield path;
  }
}

async function glyphText(): Promise<string> {
  const chars = new Set<string>();
  for (let code = 0x20; code <= 0x7e; code++) chars.add(String.fromCharCode(code));
  for (const ch of '、，。：；！？“”‘’（）《》—…·') chars.add(ch);
  for await (const file of walk(fixturesDir)) {
    for (const ch of await readFile(file, 'utf8')) chars.add(ch);
  }
  chars.delete('\n');
  chars.delete('\r');
  return [...chars].join('');
}

const subset = await subsetFont(await loadSource(), await glyphText(), {
  targetFormat: 'woff2',
  preserveNameIds: [13, 14],
});
await mkdir(dirname(output), { recursive: true });
await writeFile(output, subset);
console.log(`${output}: ${subset.length} bytes`);
