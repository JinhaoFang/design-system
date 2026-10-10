/*
 * Behavior tests for the shared sample content (library/content, the Reedslip 2.0 standard sample), driven through buildAndCheck with a fixture system.
 * Works reference the shared keys only ({"ref": key}); keys are "<unit>.<slot>" or "<unit>.<instance>.<slot>". All three carriers are built end to end: social per unit
 * (PNG at the exact canvas size, shared text on the page); web and slides as one work holding every unit instance, whose rendered page must show every image (none broken).
 * Image paths in the content are relative to library/content, must exist there, and the build copies them into the output directory.
 */
import { access, cp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, test } from 'vitest';
import { chromium } from 'playwright';
import { CARRIER_IDS } from '../src/carriers.ts';
import type { CarrierId } from '../src/carriers.ts';
import { fixtures, pngSize, run, tempDir } from './helpers.ts';
import { allCarriersSystem, patchedLibrary, realSkeleton, writeFileDeep } from './system-helpers.ts';

const here = dirname(fileURLToPath(import.meta.url));
const contentDir = join(here, '..', 'library', 'content');

type Value = string | string[] | { src: string; alt: string } | { src: string; alt: string }[];
type Skeleton = { units: Record<string, { slots: Record<string, unknown> }> };

const readJson = async <T>(path: string): Promise<T> => JSON.parse(await readFile(path, 'utf8')) as T;
const skeletonOf = (carrier: string): Promise<Skeleton> => readJson(join(realSkeleton, `${carrier}.json`));
const contentOf = (carrier: string): Promise<Record<string, Value>> => readJson(join(contentDir, `${carrier}.json`));

const SOCIAL_CANVAS: Record<string, { name: string; width: number; height: number }> = {
  title: { name: 'wechat-cover', width: 900, height: 383 },
  quote: { name: 'square', width: 1080, height: 1080 },
  list: { name: 'xiaohongshu', width: 1080, height: 1440 },
  data: { name: 'square', width: 1080, height: 1080 },
};

async function instancesOf(carrier: string, unit: string): Promise<{ instance: string; refs: Record<string, { ref: string }> }[]> {
  const content = await contentOf(carrier);
  const skeleton = await skeletonOf(carrier);
  const slots = Object.keys(skeleton.units[unit]!.slots);
  const found = new Map<string, Record<string, { ref: string }>>();
  for (const key of Object.keys(content)) {
    const parts = key.split('.');
    if (parts[0] !== unit || ![2, 3].includes(parts.length)) continue;
    const slot = parts.at(-1)!;
    const instance = parts.length === 3 ? parts[1]! : '';
    if (slots.includes(slot)) (found.get(instance) ?? found.set(instance, {}).get(instance)!)[slot] = { ref: key };
  }
  return [...found].map(([instance, refs]) => ({ instance, refs }));
}

async function sampleLibrary(): Promise<string> {
  return patchedLibrary(async (dir) => {
    await rm(join(dir, 'skeleton'), { recursive: true });
    await cp(realSkeleton, join(dir, 'skeleton'), { recursive: true });
    await cp(contentDir, join(dir, 'content'), { recursive: true });
  });
}

async function sampleSystem(): Promise<string> {
  return allCarriersSystem(async (dir) => {
    for (const carrier of CARRIER_IDS) {
      const skeleton = await skeletonOf(carrier);
      for (const [unit, spec] of Object.entries(skeleton.units)) {
      const listSlots = Object.keys(spec.slots);
      const body = listSlots.map((slot) => {
        const maxItems = (spec.slots[slot] as { maxItems?: number }).maxItems;
        return maxItems === undefined ? `<p>{{ slots.${slot} }}</p>` : `{% for item in slots.${slot} %}<p>{{ item }}</p>{% endfor %}`;
      });
      const html =
        `<style>:scope{box-sizing:border-box;width:100%;height:100%;padding:calc(var(--ds-space-3) * 2);display:flex;flex-direction:column;justify-content:center;gap:var(--ds-space-2);background:var(--ds-color-paper);color:var(--ds-color-ink);font-family:var(--ds-font-body)} p{margin:0;font-size:var(--ds-type-0);line-height:1.5}</style>` +
        body.join('');
      await writeFileDeep(join(dir, 'layouts', carrier, unit, 'plain.liquid'), html);
      }
    }
  });
}

const workFile = async (work: unknown): Promise<string> => {
  const path = join(await tempDir(), 'work.json');
  await writeFile(path, JSON.stringify(work));
  return path;
};

const imagesIn = (content: Record<string, Value>): string[] =>
  Object.values(content).flatMap((value) => (Array.isArray(value) ? value : [value]).flatMap((item) => (typeof item === 'object' ? [item.src] : [])));

describe.each(CARRIER_IDS)('sample content for %s', (carrier: CarrierId) => {
  test('covers every slot of every narrative unit in the skeleton', async () => {
    const skeleton = await skeletonOf(carrier);
    const missing: string[] = [];
    for (const [unit, spec] of Object.entries(skeleton.units)) {
      const instances = await instancesOf(carrier, unit);
      if (instances.length === 0) missing.push(`${unit}: no content`);
      for (const { instance, refs } of instances) {
        for (const slot of Object.keys(spec.slots)) if (!(slot in refs)) missing.push(`${unit}${instance ? `.${instance}` : ''}: ${slot}`);
      }
    }
    expect(missing).toEqual([]);
  });

  test('every image path exists as a PNG under library/content', async () => {
    for (const src of imagesIn(await contentOf(carrier))) {
      await access(join(contentDir, src));
      expect((await pngSize(join(contentDir, src))).width).toBeGreaterThan(0);
    }
  });

  if (carrier === 'social') {
    test.each(Object.keys(SOCIAL_CANVAS))('unit %s renders from shared keys at its canvas size with the shared text on the page', async (unit) => {
      const canvas = SOCIAL_CANVAS[unit]!;
      const library = await sampleLibrary();
      const system = await sampleSystem();
      const content = await contentOf(carrier);
      for (const { refs } of await instancesOf(carrier, unit)) {
        const work = await workFile({
          system: 'mini',
          carrier,
          canvas: canvas.name,
          concept: '样张内容测试',
          sequence: [{ unit, layout: 'plain', content: refs }],
        });
        const result = await run(work, { libraryDir: library, systemDir: system });
        expect(await pngSize(result.artifacts.images[0]!)).toEqual({ width: canvas.width, height: canvas.height });
        const first = Object.values(refs)[0]!.ref;
        const text = [content[first]!].flat()[0] as string;
        expect(await readFile(result.artifacts.index, 'utf8')).toContain(text);
      }
    });
  } else {
    test('every unit builds end to end from shared keys and every image on the page loads', async () => {
      const skeleton = await skeletonOf(carrier);
      const content = await contentOf(carrier);
      const sequence: unknown[] = [];
      const expectedImages: string[] = [];
      for (const unit of Object.keys(skeleton.units)) {
        for (const { refs } of await instancesOf(carrier, unit)) {
          sequence.push({ unit, layout: 'plain', content: refs });
          expectedImages.push(...imagesIn(Object.fromEntries(Object.values(refs).map(({ ref }) => [ref, content[ref]!]))));
        }
      }
      expect(expectedImages.length).toBeGreaterThan(0);
      const work = await workFile({ system: 'mini', carrier, concept: '样张内容测试', sequence });
      const result = await run(work, { libraryDir: await sampleLibrary(), systemDir: await sampleSystem() });
      expect(result.report.findings.filter((finding) => finding.severity === 'error')).toEqual([]);
      expect(result.artifacts.images.length).toBeGreaterThan(0);

      const browser = await chromium.launch();
      try {
        const page = await browser.newPage();
        await page.goto(pathToFileURL(result.artifacts.index).href);
        await page.waitForLoadState('load');
        const images = await page.evaluate(() =>
          [...document.images].map((img) => ({ src: img.getAttribute('src')!, loaded: img.complete && img.naturalWidth > 0 })),
        );
        expect(images.map((img) => img.src).sort()).toEqual([...expectedImages].sort());
        expect(images.filter((img) => !img.loaded)).toEqual([]);
      } finally {
        await browser.close();
      }
    });
  }
});

describe('image assets in a work', () => {
  const imageWork = (src: string) =>
    workFile({
      system: 'mini',
      carrier: 'slides',
      concept: '图片路径测试',
      sequence: [{ unit: 'image', layout: 'plain', content: { visual: { src, alt: '说明' }, heading: '标题', caption: '图注' } }],
    });

  test.each([['assets/missing.png', /图片文件不存在/], ['../skeleton/slides.json', /超出了共享内容目录/]])('image path %s fails the build with a clear error', async (src, message) => {
    await expect(run(await imageWork(src), { libraryDir: await sampleLibrary(), systemDir: await sampleSystem() })).rejects.toThrow(message);
  });
});
