/*
 * Behavior tests for the shared sample content (library/content, the Reedslip 2.0 standard sample), driven through buildAndCheck with a fixture system.
 * Works reference the shared keys only ({"ref": key}); keys are "<unit>.<slot>" or "<unit>.<instance>.<slot>". Carriers the pipeline can render are built end to end
 * (PNG at the exact canvas size, shared text on the page); carriers it cannot render yet must get through work validation, i.e. every reference resolves and every limit holds,
 * and stop only at the "not implemented" error. Image paths in the content must exist under library/content.
 */
import { access, cp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { CARRIER_IDS, RENDERABLE_CARRIERS } from '../src/carriers.ts';
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
  const skeleton = await skeletonOf('social');
  return allCarriersSystem(async (dir) => {
    for (const [unit, spec] of Object.entries(skeleton.units)) {
      const listSlots = Object.keys(spec.slots);
      const body = listSlots.map((slot) => {
        const maxItems = (spec.slots[slot] as { maxItems?: number }).maxItems;
        return maxItems === undefined ? `<p>{{ slots.${slot} }}</p>` : `{% for item in slots.${slot} %}<p>{{ item }}</p>{% endfor %}`;
      });
      const html =
        `<style>:scope{box-sizing:border-box;width:100%;height:100%;padding:calc(var(--ds-space-3) * 2);display:flex;flex-direction:column;justify-content:center;gap:var(--ds-space-2);background:var(--ds-color-paper);color:var(--ds-color-ink);font-family:var(--ds-font-body)} p{margin:0;font-size:var(--ds-type-0);line-height:1.5}</style>` +
        body.join('');
      await writeFileDeep(join(dir, 'layouts', 'social', unit, 'plain.liquid'), html);
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

  if (RENDERABLE_CARRIERS.includes(carrier)) {
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
    test('every unit passes work validation with all references resolved and stops only at the missing renderer', async () => {
      const skeleton = await skeletonOf(carrier);
      const sequence: unknown[] = [];
      for (const unit of Object.keys(skeleton.units)) {
        for (const { refs } of await instancesOf(carrier, unit)) sequence.push({ unit, layout: 'any', content: refs });
      }
      const work = await workFile({ system: 'mini', carrier, concept: '样张内容测试', sequence });
      await expect(run(work, { libraryDir: await sampleLibrary(), systemDir: await sampleSystem() })).rejects.toThrow(/尚未实现/);
    });
  }
});
