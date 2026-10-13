/*
 * Work-owned image briefs and custom fragment image assets, tested only through buildAndCheck with fixture systems.
 * Assert rendered alt text, loaded images, copied files and validation failures; no HTML snapshots or pixel comparisons.
 */
import { copyFile, readFile, readdir, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { describe, expect, test } from 'vitest';
import { fixtures, patchedWork, run } from './helpers.ts';
import { editJson, patchedLibrary, patchedSystem, writeFileDeep } from './system-helpers.ts';

const brief = { brief: '一张图', alt: '作品图像' };
const picture = join(fixtures.system, 'images', 'mark-luxi-town.svg');
const fragment = (tags: string) => `<style>:scope{padding:var(--ds-space-4);background:var(--ds-color-paper);font-family:var(--ds-font-body);color:var(--ds-color-ink);font-size:var(--ds-type-1)}p{margin:0;line-height:1.5}</style>${tags}`;
const customWork = (custom: unknown, images: unknown = { 'work-image': brief }) =>
  patchedWork('clean', (work) => {
    work.images = images;
    work.sequence = [{ custom, serves: '验证作品图像' }];
  });
const imageSystem = () => patchedSystem((dir) => copyFile(picture, join(dir, 'images', 'work-image.svg')));
const slotLibrary = (images?: Record<string, unknown>) => patchedLibrary(async (dir) => {
  await editJson(join(dir, 'skeleton', 'social.json'), (data) => {
    data.units.title.slots.photos = { type: 'image', priority: 'secondary', maxChars: 8, maxItems: 3 };
  });
  if (images) await writeFileDeep(join(dir, 'content', 'images.json'), JSON.stringify(images));
});
const slotSystem = () => patchedSystem(async (dir) => {
  await copyFile(picture, join(dir, 'images', 'work-image.svg'));
  const layout = join(dir, 'layouts', 'social', 'title', 'stack.liquid');
  await writeFileDeep(layout, await readFile(layout, 'utf8') + '{% for photo in slots.photos %}{{ photo }}{% endfor %}');
});

async function renderedImages(index: string): Promise<{ alt: string; src: string | null; loaded: boolean }[]> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(index).href);
    return await page.evaluate(() => [...document.images].map((image) => ({
      alt: image.alt,
      src: image.getAttribute('src'),
      loaded: image.complete && image.naturalWidth > 0 && image.getBoundingClientRect().width > 0,
    })));
  } finally {
    await browser.close();
  }
}

describe('work image briefs', () => {
  test.each([false, true])('image slots use work briefs, with a library brief present: %s', async (shared) => {
    const work = await patchedWork('clean', (work) => {
      work.images = { 'work-image': brief };
      work.sequence[0].content.photos = [{ image: 'work-image' }, ...(shared ? [{ image: 'mark-luxi-town' }] : [])];
    });
    const result = await run(work, {
      systemDir: await slotSystem(),
      libraryDir: await slotLibrary(shared ? { 'work-image': { brief: '共享图', alt: '共享替代文字太长也不应使用' }, 'mark-luxi-town': { brief: '共享图', alt: '共享图像' } } : undefined),
    });
    expect(result.exitCode).toBe(0);
    expect(await renderedImages(result.artifacts.index)).toEqual([
      { alt: brief.alt, src: 'images/work-image.svg', loaded: true },
      ...(shared ? [{ alt: '共享图像', src: 'images/mark-luxi-town.svg', loaded: true }] : []),
    ]);
    expect(await readFile(join(result.artifacts.outDir, 'images', 'work-image.svg'))).toEqual(await readFile(picture));
  });

  test.each([
    ['not a map', [], /作品描述 images.*对象/],
    ['invalid id', { '../escape': brief }, /标识.*escape/],
    ['missing brief', { 'work-image': { alt: '图' } }, /work-image.*brief/],
    ['missing alt', { 'work-image': { brief: '图' } }, /work-image.*alt/],
  ])('%s fails before rendering', async (_name, images, message) => {
    await expect(run(await customWork('<p>标题</p>', images))).rejects.toThrow(message);
  });

  test('work alt remains subject to the image slot character limit', async () => {
    const work = await patchedWork('clean', (work) => {
      work.images = { 'work-image': { brief: '图', alt: '这段作品替代文字超过八个字' } };
      work.sequence[0].content.photos = [{ image: 'work-image' }];
    });
    await expect(run(work, { libraryDir: await slotLibrary() })).rejects.toThrow(/photos.*字数上限/);
  });
});

describe('custom fragment image assets', () => {
  test.each([false, true])('copies literal image sources and retains authored alt, file-backed: %s', async (fileBacked) => {
    const html = fragment(`<img alt="片段图像" src="images/work-image.svg"><IMG SRC='images/work-image.svg' alt=""><img src=images/work-image.svg alt="">`);
    const systemDir = await imageSystem();
    if (fileBacked) await writeFileDeep(join(systemDir, 'works', 'fragments', 'image.html'), html);
    const result = await run(await customWork(fileBacked ? { file: 'fragments/image.html' } : html), { systemDir });
    expect(result.exitCode).toBe(0);
    expect(await readdir(join(result.artifacts.outDir, 'images'))).toEqual(['work-image.svg']);
    expect(await readFile(join(result.artifacts.outDir, 'images', 'work-image.svg'))).toEqual(await readFile(picture));
    expect(await renderedImages(result.artifacts.index)).toEqual([
      { alt: '片段图像', src: 'images/work-image.svg', loaded: true },
      { alt: '', src: 'images/work-image.svg', loaded: true },
      { alt: '', src: 'images/work-image.svg', loaded: true },
    ]);
  });

  test('custom images can use a shared brief and select an exact format', async () => {
    const systemDir = await imageSystem();
    await copyFile(picture, join(systemDir, 'images', 'work-image.png'));
    const libraryDir = await patchedLibrary((dir) => writeFileDeep(join(dir, 'content', 'images.json'), JSON.stringify({ 'work-image': brief })));
    const result = await run(await customWork(fragment('<img src="images/work-image.svg" alt=""><p>标题</p>'), {}), { systemDir, libraryDir });
    expect(result.exitCode).toBe(0);
    expect(await readdir(join(result.artifacts.outDir, 'images'))).toEqual(['work-image.svg']);
  });

  test('missing files are validation errors even when a different format exists', async () => {
    await expect(run(await customWork('<img src="images/work-image.png" alt="">'), { systemDir: await imageSystem() })).rejects.toThrow(/第 1 项.*缺少图像文件.*work-image.png/);
  });

  test('a custom image without a brief fails', async () => {
    await expect(run(await customWork('<img src="images/mark-luxi-town.svg" alt="">'))).rejects.toThrow(/mark-luxi-town.*图像简报/);
  });

  test.each(['images/../work-image.svg', 'images/work-image.svg?size=1', 'images/work-image.txt'])('rejects unsupported local path %s', async (src) => {
    await expect(run(await customWork(`<img src="${src}" alt="">`))).rejects.toThrow(/路径需要是 images/);
  });

  test('a symlink outside system images is rejected', async () => {
    const systemDir = await patchedSystem((dir) => symlink(picture, join(dir, 'images', 'work-image.svg')));
    await expect(run(await customWork('<img src="images/work-image.svg" alt="">'), { systemDir })).rejects.toThrow(/跑出了体系 images/);
  });

  test('comments, raw text and other attributes are not image references', async () => {
    const html = fragment(`<!-- <img src="images/missing.svg"> --><script type="application/json">"<img src='images/missing.svg'>"</script><style>:scope::before{content:'<img src="images/missing.svg">'}</style><div data-src="images/missing.svg"></div><img alt="src='images/missing.svg'" src="images/work-image.svg">`);
    const result = await run(await customWork(html), { systemDir: await imageSystem() });
    expect(await readdir(join(result.artifacts.outDir, 'images'))).toEqual(['work-image.svg']);
  });
});
