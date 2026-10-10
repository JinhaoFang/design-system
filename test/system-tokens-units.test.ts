/* Behavior tests for the token file structure, system-specific narrative units and the shared skeleton, driven through validateSystem and buildAndCheck. */
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { validateSystem } from '../src/build-and-check.ts';
import { fixtures, patchedWork, run } from './helpers.ts';
import { NS, allCarriersSystem, editJson, patchedLibrary, patchedSystem, realSkeletonLibrary, tokensFile, writeFileDeep } from './system-helpers.ts';

const validate = (systemDir: string, libraryDir = fixtures.library) => validateSystem({ systemDir, libraryDir });

describe('token file structure', () => {
  const broken = (edit: (json: any) => void) => patchedSystem((d) => editJson(tokensFile(d), edit));

  test.each([
    ['an unknown top-level group', (j: any) => (j.sparkle = { $type: 'number', a: { $value: 1 } }), /sparkle\.a/],
    ['an alias reference', (j: any) => (j.color.accent = { $value: '{color.ink}' }), /color\.accent[\s\S]*别名/],
    ['a ratio that is not a number', (j: any) => (j.ratio.type['1'] = { $value: 'big' }), /ratio\.type\.1/],
    ['a color with a bad color space', (j: any) => (j.color.ink.$value.colorSpace = 'cmyk'), /color\.ink[\s\S]*cmyk/],
    ['a cubic bezier with x outside 0-1', (j: any) => (j.easing.settle.$value = [2, 0, 0.2, 1]), /easing\.settle/],
    ['a duration step with a wrong type', (j: any) => (j.ratio.duration.base = { $type: 'color', $value: { colorSpace: 'srgb', components: [0, 0, 0] } }), /ratio\.duration\.base/],
    ['a font token without a font-list id', (j: any) => delete j.font.body.$extensions, /font\.body[\s\S]*fontId/],
    ['a spring with an unknown parameter', (j: any) => (j.spring.soft.bounce = { $value: 1 }), /spring\.soft\.bounce/],
    ['a shadow layer missing a field', (j: any) => delete j.shadow.raised.$value[0].blur, /shadow\.raised[\s\S]*blur/],
  ])('%s fails and names the token', async (_case, edit, message) => {
    await expect(validate(await broken(edit))).rejects.toThrow(message);
  });

  test('a font id missing from the font list fails', async () => {
    const dir = await broken((j) => (j.font.cjk.$extensions[NS].fontId = 'no-such-font'));
    await expect(validate(dir)).rejects.toThrow(/font\.cjk[\s\S]*no-such-font[\s\S]*字体清单/);
  });

  test('a missing carrier base value fails and names the carrier and base', async () => {
    const dir = await broken((j) => delete j.carrier.social.durationBase);
    await expect(validate(dir)).rejects.toThrow(/carrier\.social\.durationBase/);
  });

  test('a base value of the wrong type fails', async () => {
    const dir = await broken((j) => (j.carrier.social.body = { $type: 'duration', $value: { value: 10, unit: 'ms' } }));
    await expect(validate(dir)).rejects.toThrow(/carrier\.social\.body/);
  });

  test.each([
    ['light direction', (j: any) => delete j.$extensions[NS].constraints.lightAngleDeg, /lightAngleDeg/],
    ['grain ceiling', (j: any) => delete j.$extensions[NS].constraints.grainMax, /grainMax/],
    ['accent budget', (j: any) => (j.$extensions[NS].constraints.accentBudget = 3), /accentBudget/],
    ['composition ranges for a declared carrier', (j: any) => delete j.$extensions[NS].constraints.composition.social, /composition\.social/],
    ['a reversed composition range', (j: any) => (j.$extensions[NS].constraints.composition.social.jumpRate = [4, 2]), /jumpRate/],
    ['the whole constraints block', (j: any) => delete j.$extensions, /检查约束/],
  ])('missing or bad %s fails', async (_case, edit, message) => {
    await expect(validate(await broken(edit))).rejects.toThrow(message);
  });

  test('a grain token above the declared ceiling fails', async () => {
    const dir = await broken((j) => (j.grain.max.$value = 0.5));
    await expect(validate(dir)).rejects.toThrow(/grain\.max[\s\S]*grainMax/);
  });

  test('a token file that is not JSON fails', async () => {
    const dir = await patchedSystem((d) => writeFileDeep(tokensFile(d), '{ nope'));
    await expect(validate(dir)).rejects.toThrow(/数值文件/);
  });

  test('a missing token file fails', async () => {
    const dir = await patchedSystem((d) => rm(tokensFile(d)));
    await expect(validate(dir)).rejects.toThrow(/system\.tokens\.json/);
  });
});

describe('system-specific narrative units', () => {
  const verse = {
    label: '诗句型',
    slots: {
      line: { type: 'text', priority: 'primary', maxChars: 12 },
      lines: { type: 'text', priority: 'secondary', maxChars: 14, maxItems: 4 },
    },
  };
  const verseLayout =
    '<style>:scope{padding:var(--ds-space-2);font-family:var(--ds-font-body);font-size:var(--ds-type-1);color:var(--ds-color-ink);background:var(--ds-color-paper)}p{margin:0}</style><p>{{ slots.line }}</p>{% for l in slots.lines %}<p>{{ l }}</p>{% endfor %}';

  test('a system can add its own unit with a layout and build a work with it', async () => {
    const system = await patchedSystem(async (d) => {
      await writeFileDeep(join(d, 'skeleton', 'social.json'), JSON.stringify({ units: { verse } }));
      await writeFileDeep(join(d, 'layouts', 'social', 'verse', 'plain.liquid'), verseLayout);
    });
    const work = await patchedWork('clean', (w) => {
      w.sequence = [{ unit: 'verse', layout: 'plain', content: { line: '一行诗', lines: ['第一句', '第二句'] } }];
    });
    const result = await run(work, { systemDir: system });
    expect(result.report.findings).toEqual([]);
  });

  test('the same work fails on a system that does not have the unit', async () => {
    const work = await patchedWork('clean', (w) => {
      w.sequence = [{ unit: 'verse', layout: 'plain', content: { line: '一行诗' } }];
    });
    await expect(run(work)).rejects.toThrow(/verse/);
  });

  test('an own unit that reuses a shared unit id fails and names it', async () => {
    const system = await patchedSystem((d) => writeFileDeep(join(d, 'skeleton', 'social.json'), JSON.stringify({ units: { title: verse } })));
    await expect(validate(system)).rejects.toThrow(/「title」[\s\S]*冲突/);
  });

  test('an own unit with a malformed slot fails', async () => {
    const system = await patchedSystem((d) =>
      writeFileDeep(
        join(d, 'skeleton', 'social.json'),
        JSON.stringify({ units: { verse: { label: '诗', slots: { line: { type: 'poem', priority: 'primary', maxChars: 0 } } } } }),
      ),
    );
    await expect(validate(system)).rejects.toThrow(/verse[\s\S]*line[\s\S]*type/);
  });
});

describe('shared skeleton', () => {
  test.each([
    ['an unknown slot type', (j: any) => (j.units.title.slots.title.type = 'poem'), /title[\s\S]*type/],
    ['an unknown priority', (j: any) => (j.units.title.slots.title.priority = 'main'), /priority/],
    ['a non-positive character limit', (j: any) => (j.units.title.slots.title.maxChars = 0), /maxChars/],
    ['a unit without a primary slot', (j: any) => (j.units.title.slots.title.priority = 'secondary'), /主要槽位/],
    ['a wrong carrier field', (j: any) => (j.carrier = 'web'), /carrier/],
  ])('%s fails and names it', async (_case, edit, message) => {
    const library = await patchedLibrary((d) => editJson(join(d, 'skeleton', 'social.json'), edit));
    await expect(validate(fixtures.system, library)).rejects.toThrow(message);
  });

  test('the real library skeleton is well formed for all three carriers and loads for a system that declares them', async () => {
    const library = await realSkeletonLibrary();
    const system = await allCarriersSystem();
    const result = await validate(system, library);
    expect(Object.keys(result.skeletons).sort()).toEqual(['slides', 'social', 'web']);
    expect(Object.keys(result.skeletons.web!.units)).toEqual(['hero', 'problem', 'solution', 'features', 'evidence', 'process', 'cta', 'footer']);
    expect(Object.keys(result.skeletons.slides!.units)).toEqual(['cover', 'agenda', 'section', 'statement', 'data', 'compare', 'process', 'quote', 'image', 'closing']);
    expect(Object.keys(result.skeletons.social!.units)).toEqual(['title', 'quote', 'list', 'data']);
  });
});
