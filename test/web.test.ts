/* Behavior tests for the web (展示型网页) carrier through buildAndCheck: two full-page screenshot widths, exact viewport-height segments, a timestamped entrance contact sheet, a scroll recording, settled static output, and checker findings located by unit/layout/slot. */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { fixtures, patchedWork, pngSize, run } from './helpers.ts';
import { patchedSystem, writeFileDeep } from './system-helpers.ts';

const heroLayout = (css: string, body = '<h1 class="headline">{{ slots.headline }}</h1><p class="lead">{{ slots.lead }}</p>') =>
  `<style>:scope{box-sizing:border-box;min-height:100vh;padding:var(--ds-space-3);background:var(--ds-color-paper);color:var(--ds-color-ink);font-family:var(--ds-font-body)} .headline{margin:0;font-size:var(--ds-type-2)} .lead{margin:0;font-size:var(--ds-type-1)} ${css}</style>${body}`;

const heroSystem = (name: string, source: string) =>
  patchedSystem((dir) => writeFileDeep(join(dir, 'layouts', 'web', 'hero', `${name}.liquid`), source));

const heroWork = (layout: string) =>
  patchedWork('web-clean', (w) => {
    w.sequence[0].layout = layout;
  });

describe('web work', () => {
  test('builds clean, with full-page screenshots, exact segments, an entrance sheet and a scroll recording', async () => {
    const result = await run(fixtures.work('web-clean'));
    expect(result.report.findings).toEqual([]);
    expect(result.exitCode).toBe(0);

    const [desktop, mobile] = result.artifacts.images;
    expect(desktop).toMatch(/web-desktop\.png$/);
    expect(mobile).toMatch(/web-mobile\.png$/);
    const desktopSize = await pngSize(desktop!);
    const mobileSize = await pngSize(mobile!);
    expect(desktopSize.width).toBe(1440);
    expect(mobileSize.width).toBe(390);
    expect(desktopSize.height).toBeGreaterThan(900);
    expect(mobileSize.height).toBeGreaterThan(844);

    const qa = JSON.parse(await readFile(join(result.artifacts.outDir, 'web-qa.json'), 'utf8'));
    const files = await readdir(result.artifacts.outDir);
    for (const [name, size, height] of [['desktop', desktopSize, 900], ['mobile', mobileSize, 844]] as const) {
      const segments = qa.segments[name];
      const expectedCount = Math.ceil(size.height / height);
      expect(segments).toMatchObject({ width: size.width, height: size.height, segmentHeight: height });
      expect(segments.segments).toHaveLength(expectedCount);
      expect(files.filter((file) => file.startsWith(`web-segment-${name}-`))).toHaveLength(expectedCount);
      for (const [index, segment] of segments.segments.entries()) {
        expect(segment.file).toBe(`web-segment-${name}-${String(index + 1).padStart(3, '0')}.png`);
        expect(segment.y).toBe(index * height);
        const segmentSize = await pngSize(join(result.artifacts.outDir, segment.file));
        expect(segmentSize).toEqual({ width: size.width, height: Math.min(height, size.height - index * height) });
        expect(segment.height).toBe(segmentSize.height);
      }
      expect(segments.segments.reduce((sum: number, segment: { height: number }) => sum + segment.height, 0)).toBe(size.height);
    }
    const entrance = qa.entrance;
    expect(entrance.intervalMs).toBe(200);
    expect(entrance.durationMs).toBeGreaterThanOrEqual(800);
    expect(entrance.frames).toHaveLength(entrance.durationMs / entrance.intervalMs + 1);
    expect(entrance.actualDurationMs).toBe(entrance.frames.at(-1).timeMs);
    for (const [index, frame] of entrance.frames.entries()) {
      expect(frame.scheduledMs).toBe(index * entrance.intervalMs);
      expect(frame.timeMs).toBeGreaterThanOrEqual(frame.scheduledMs - 1);
      expect(frame.captureDurationMs).toBeGreaterThanOrEqual(0);
      if (index) expect(frame.timeMs).toBeGreaterThan(entrance.frames[index - 1].timeMs);
    }
    expect(entrance.width).toBe(1440);
    expect(entrance.height).toBe(Math.ceil(entrance.frames.length / entrance.columns) * entrance.cellHeight);
    expect(await pngSize(join(result.artifacts.outDir, entrance.file))).toEqual({ width: entrance.width, height: entrance.height });

    const video = result.artifacts.video!;
    expect(video).toMatch(/web-scroll\.webm$/);
    expect((await stat(video)).size).toBeGreaterThan(1000);
    expect((await readFile(video)).subarray(0, 4).toString('hex')).toBe('1a45dfa3');
  });

  test('a finding inside the second unit keeps its unit, layout and slot', async () => {
    const result = await run(
      await patchedWork('web-clean', (w) => {
        w.sequence[1].layout = 'columns';
      }),
      {
        systemDir: await patchedSystem((dir) =>
          writeFileDeep(
            join(dir, 'layouts', 'web', 'features', 'columns.liquid'),
            '<style>:scope{padding:var(--ds-space-2);background:var(--ds-color-paper);color:var(--ds-color-ink);font-family:var(--ds-font-body)} .t{color:#000;font-size:var(--ds-type-1);margin:0} h2{margin:0;font-size:var(--ds-type-2)}</style>{% for title in slots.itemTitles %}<h3 class="t">{{ title }}</h3>{% endfor %}<h2>{{ slots.heading }}</h2>',
          ),
        ),
      },
    );
    expect(result.exitCode).toBe(1);
    expect(result.report.findings).toEqual(
      Array(3).fill(
        expect.objectContaining({
          ruleId: 'texture-floor/pure-black-white',
          location: expect.objectContaining({ unit: 'features', layout: 'columns', slot: 'itemTitles' }),
        }),
      ),
    );
  });

  test('entry animations are finished before the checker and screenshots look at the page', async () => {
    const flash = heroLayout(
      '.headline{color:#000;animation:settle-in 3s linear both} @keyframes settle-in{from{color:#000}to{color:var(--ds-color-ink)}}',
    );
    const result = await run(await heroWork('flash'), { systemDir: await heroSystem('flash', flash) });
    expect(result.report.findings.filter((finding) => finding.category !== 'motion')).toEqual([]);
  });

  test('every unit is revealed by the static render switch, so reveal-on-scroll units are not hidden below the fold', async () => {
    const hidden = heroLayout(':root:not([data-render="static"]) :scope .headline{color:#000}');
    const result = await run(await heroWork('hidden'), { systemDir: await heroSystem('hidden', hidden) });
    expect(result.report.findings).toEqual([]);
  });

  test('a mobile-only violation is reported, marked as coming from the narrow width', async () => {
    const narrow = heroLayout('@media (max-width:500px){.headline{color:#000}}');
    const result = await run(await heroWork('narrow'), { systemDir: await heroSystem('narrow', narrow) });
    expect(result.exitCode).toBe(1);
    expect(result.report.findings).toEqual([
      expect.objectContaining({
        ruleId: 'texture-floor/pure-black-white',
        location: expect.objectContaining({ unit: 'hero', layout: 'narrow', slot: 'headline' }),
        message: expect.stringContaining('390'),
      }),
    ]);
  });
});
