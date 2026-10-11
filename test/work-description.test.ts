/* Behavior tests for the work description format (list and image slots, shared content refs, custom fragments, carrier checks), the generated CSS custom properties and the validate-system subcommand. */
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, test } from 'vitest';
import { fixtures, patchedWork, run } from './helpers.ts';
import {
  allCarriersSystem,
  editJson,
  editText,
  patchedLibrary,
  patchedSystem,
  realSkeletonLibrary,
  systemMd,
  tokensFile,
  writeFileDeep,
} from './system-helpers.ts';

const execFileAsync = promisify(execFile);

const LIST_UNIT = {
  label: '清单型',
  slots: {
    heading: { type: 'text', priority: 'primary', maxChars: 16 },
    items: { type: 'text', priority: 'secondary', maxChars: 10, maxItems: 3, group: 'rows' },
    notes: { type: 'text', priority: 'tertiary', maxChars: 10, maxItems: 3, group: 'rows' },
    photo: { type: 'image', priority: 'tertiary', maxChars: 8 },
  },
};

const withListUnit = (): Promise<string> =>
  patchedLibrary(async (dir) => {
    await editJson(join(dir, 'skeleton', 'social.json'), (j) => (j.units.list = LIST_UNIT));
    await writeFileDeep(join(dir, 'content', 'images.json'), JSON.stringify({ 'long-alt': { brief: '一张图', alt: '这段说明文字明显太长了' } }));
  });

const listSystem = (itemStyle = 'color:var(--ds-color-ink)'): Promise<string> =>
  patchedSystem((dir) =>
    writeFileDeep(
      join(dir, 'layouts', 'social', 'list', 'rows.liquid'),
      `<style>:scope{padding:24px;background:var(--ds-color-paper);font-family:var(--ds-font-body);color:var(--ds-color-ink)} .row{${itemStyle};font-size:var(--ds-type-1)}</style><h1>{{ slots.heading }}</h1>{% for item in slots.items %}<p class="row">{{ item }}</p>{% endfor %}`,
    ),
  );

const listWork = (content: Record<string, unknown>): Promise<string> =>
  patchedWork('clean', (w) => {
    w.sequence = [{ unit: 'list', layout: 'rows', content }];
  });

describe('list and image slots', () => {
  test('a list slot renders every item as its own marked node and a clean work has no findings', async () => {
    const result = await run(await listWork({ heading: '三件事', items: ['第一件', '第二件'] }), {
      libraryDir: await withListUnit(),
      systemDir: await listSystem(),
    });
    expect(result.report.findings).toEqual([]);
    const html = await readFile(result.artifacts.index, 'utf8');
    expect(html).toContain('data-ds-slot="items" data-ds-index="0"');
    expect(html).toContain('data-ds-slot="items" data-ds-index="1"');
  });

  test('a violation inside a list item is located at that slot', async () => {
    const result = await run(await listWork({ heading: '三件事', items: ['第一件'] }), {
      libraryDir: await withListUnit(),
      systemDir: await listSystem('color:#000'),
    });
    expect(result.report.findings).toEqual([
      expect.objectContaining({ location: expect.objectContaining({ unit: 'list', layout: 'rows', slot: 'items' }) }),
    ]);
  });

  test.each([
    ['too many items', { heading: '标题', items: ['一', '二', '三', '四'] }, /items[\s\S]*项数超出上限/],
    ['an item over the character limit', { heading: '标题', items: ['这一项明显超过了十个字的上限'] }, /items 第 1 项[\s\S]*字数上限/],
    ['a plain string for a list slot', { heading: '标题', items: '不是数组' }, /items[\s\S]*列表槽位/],
    ['an array for a single slot', { heading: ['a', 'b'] }, /heading[\s\S]*不是列表槽位/],
    ['unequal lengths in one group', { heading: '标题', items: ['一', '二'], notes: ['注'] }, /rows[\s\S]*一致/],
    ['an image without an image id', { heading: '标题', photo: '图.png' }, /photo[\s\S]*image/],
    ['image alt over the limit', { heading: '标题', photo: { image: 'long-alt' } }, /photo[\s\S]*字数上限/],
    ['a missing primary slot', { items: ['一'] }, /缺少主要槽位 "heading"/],
    ['an empty primary slot', { heading: '' }, /缺少主要槽位 "heading"/],
  ])('%s fails before rendering', async (_case, content, message) => {
    await expect(run(await listWork(content), { libraryDir: await withListUnit() })).rejects.toThrow(message);
  });
});

describe('shared content references', () => {
  const sharedLibrary = () =>
    patchedLibrary((dir) =>
      writeFileDeep(
        join(dir, 'content', 'social.json'),
        JSON.stringify({ 'release.title': '发布二点零', 'release.tagline': '更快的搜索，更稳的同步', 'release.long': '这是一段明显超过十六个字上限的非常非常非常长的标题' }),
      ),
    );
  const refWork = (title: unknown, subtitle: unknown = '副标题') =>
    patchedWork('clean', (w) => {
      w.sequence[0].content = { title, subtitle };
    });

  test('a slot can take its content from the shared content by key', async () => {
    const result = await run(await refWork({ ref: 'release.title' }, { ref: 'release.tagline' }), { libraryDir: await sharedLibrary() });
    expect(result.report.findings).toEqual([]);
    expect(await readFile(result.artifacts.index, 'utf8')).toContain('发布二点零');
  });

  test('a key that does not exist fails and names it', async () => {
    await expect(run(await refWork({ ref: 'release.nope' }), { libraryDir: await sharedLibrary() })).rejects.toThrow(/release\.nope[\s\S]*不存在/);
  });

  test('referenced content is held to the slot character limit', async () => {
    await expect(run(await refWork({ ref: 'release.long' }), { libraryDir: await sharedLibrary() })).rejects.toThrow(/title[\s\S]*字数上限/);
  });

  test('a reference fails clearly when the library has no shared content for the carrier', async () => {
    await expect(run(await refWork({ ref: 'release.title' }))).rejects.toThrow(/release\.title[\s\S]*共享内容/);
  });
});

describe('custom fragments', () => {
  const customWork = (item: Record<string, unknown>) =>
    patchedWork('clean', (w) => {
      w.sequence = [item];
    });
  const fragment = (color: string) =>
    `<style>:scope{box-sizing:border-box;width:100%;height:100%;padding:48px;background:var(--ds-color-paper);color:${color};font-family:var(--ds-font-body)}</style><p>像一本手册的扉页</p>`;

  test('a custom fragment with its explanation builds and is checked like any other unit', async () => {
    const clean = await run(await customWork({ custom: fragment('var(--ds-color-ink)'), serves: '开场的扉页' }));
    expect(clean.report.findings).toEqual([]);
    const dirty = await run(await customWork({ custom: fragment('#000'), serves: '开场的扉页' }));
    expect(dirty.report.findings).toEqual([
      expect.objectContaining({ ruleId: 'texture-floor/pure-black-white', location: expect.objectContaining({ unit: 'custom' }) }),
    ]);
  });

  test('a custom fragment without an explanation fails', async () => {
    await expect(run(await customWork({ custom: fragment('red') }))).rejects.toThrow(/serves/);
  });

  test('a custom fragment cannot also name a unit', async () => {
    await expect(run(await customWork({ custom: fragment('red'), serves: 'x', unit: 'title' }))).rejects.toThrow(/不能同时/);
  });
});

describe('work description header', () => {
  test.each([
    ['no system', (w: any) => delete w.system, /体系 system/],
    ['an unknown carrier', (w: any) => (w.carrier = 'poster'), /poster[\s\S]*web/],
    ['no canvas for social', (w: any) => delete w.canvas, /画幅/],
    ['an unknown canvas', (w: any) => (w.canvas = 'banner'), /banner[\s\S]*xiaohongshu/],
    ['no concept', (w: any) => delete w.concept, /作品概念/],
    ['an empty sequence', (w: any) => (w.sequence = []), /sequence/],
    ['two units on a social image', (w: any) => (w.sequence = [w.sequence[0], w.sequence[0]]), /只能包含一个/],
  ])('%s fails and says why', async (_case, edit, message) => {
    await expect(run(await patchedWork('clean', edit))).rejects.toThrow(message);
  });

  test('a work for a carrier the system does not declare fails', async () => {
    const work = await patchedWork('clean', (w) => {
      w.carrier = 'web';
      delete w.canvas;
    });
    const socialOnly = await patchedSystem((dir) =>
      editText(join(dir, 'SYSTEM.md'), (t) => t.replace(/carriers:\n(  - \w+\n)+/, 'carriers:\n  - social\n')),
    );
    await expect(run(work, { systemDir: socialOnly })).rejects.toThrow(/不支持载体 web/);
  });

  test('a work written for another system still builds (reskinning)', async () => {
    const work = await patchedWork('clean', (w) => (w.system = 'some-other-system'));
    const result = await run(work);
    expect(result.report.findings).toEqual([]);
  });
});

describe('web and slides works are validated against the shared skeleton', () => {
  const setup = async () => ({ libraryDir: await realSkeletonLibrary(), systemDir: await allCarriersSystem() });
  const webWork = (content: Record<string, unknown>, unit = 'hero') =>
    patchedWork('clean', (w) => {
      w.carrier = 'web';
      delete w.canvas;
      w.sequence = [{ unit, layout: 'any', content }];
    });

  test('an unknown slot of a shared web unit fails', async () => {
    await expect(run(await webWork({ headline: '好', nope: 'x' }), await setup())).rejects.toThrow(/槽位 "nope"[\s\S]*headline/);
  });

  test('content over a shared web slot limit fails', async () => {
    await expect(run(await webWork({ headline: '这个标题的字数多到远远超过了首屏标题的上限一定会失败' }), await setup())).rejects.toThrow(/headline[\s\S]*字数上限/);
  });

  test('a slides unit is looked up in the slides skeleton', async () => {
    const work = await patchedWork('clean', (w) => {
      w.carrier = 'slides';
      delete w.canvas;
      w.sequence = [{ unit: 'hero', layout: 'any', content: { headline: '好' } }];
    });
    await expect(run(work, await setup())).rejects.toThrow(/叙事单元 "hero" 不存在[\s\S]*cover/);
  });
});

describe('CSS custom properties from the token file', () => {
  const cssOf = async (options: Parameters<typeof run>[1] = {}) => {
    const result = await run(fixtures.work('clean'), options);
    return readFile(result.artifacts.index, 'utf8');
  };

  test('ratios are multiplied by the carrier base values', async () => {
    const html = await cssOf();
    expect(html).toContain('--ds-type-0:40px');
    expect(html).toContain('--ds-type-2:100px');
    expect(html).toContain('--ds-space-3:48px');
    expect(html).toContain('--ds-radius-2:12px');
    expect(html).toContain('--ds-duration-quick:120ms');
    expect(html).toContain('--ds-duration-slow:480ms');
    expect(html).toContain('--ds-stagger-tight:60ms');
  });

  test('colors, fonts, easings, springs, shadows and grain are emitted in native CSS syntax', async () => {
    const html = await cssOf();
    expect(html).toContain('--ds-color-paper:oklch(0.97 0.012 85)');
    expect(html).toContain('--ds-font-cjk:"Noto Sans SC"');
    expect(html).toContain('--ds-easing-settle:cubic-bezier(0.2, 0.8, 0.2, 1)');
    expect(html).toContain('--ds-spring-soft-damping:24');
    expect(html).toContain('--ds-shadow-raised:2px 4px 12px 0px oklch(0.27 0.02 60 / 0.12)');
    expect(html).toContain('--ds-grain-max:0.04');
  });

  test('only the work carrier base is used when the system declares several carriers', async () => {
    const systemDir = await allCarriersSystem();
    const libraryDir = await realSkeletonLibrary();
    const html = await cssOf({ systemDir, libraryDir });
    expect(html).toContain('--ds-type-2:100px');
    expect(html).not.toContain('--ds-type-2:45px');
  });

  test('changing the carrier base value rescales every ratio', async () => {
    const systemDir = await patchedSystem((d) =>
      editJson(tokensFile(d), (j) => {
        j.carrier.social.body.$value.value = 20;
        j.carrier.social.durationBase.$value.value = 100;
      }),
    );
    const html = await cssOf({ systemDir });
    expect(html).toContain('--ds-type-2:50px');
    expect(html).toContain('--ds-duration-slow:200ms');
  });
});

describe('validate-system subcommand', () => {
  const cli = (...args: string[]) => execFileAsync(process.execPath, ['src/cli.ts', 'validate-system', ...args], { cwd: join(import.meta.dirname, '..') });

  test('exits 0 for a complete system without needing a work or an output directory', async () => {
    const { stdout } = await cli('--system', fixtures.system, '--library', fixtures.library);
    expect(stdout).toContain('校验通过');
  });

  test('exits 2 with every missing item on stderr for an incomplete system, and renders nothing', async () => {
    const system = await patchedSystem(async (d) => {
      await editText(systemMd(d), (t) => t.replace('#### 无图方案', '#### 有图方案'));
      await editJson(tokensFile(d), (j) => delete j.easing);
    });
    await expect(cli('--system', system, '--library', fixtures.library)).rejects.toMatchObject({
      code: 2,
      stderr: expect.stringMatching(/无图方案[\s\S]*缓动集/),
    });
  });
});
