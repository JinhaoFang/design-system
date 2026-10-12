/*
 * Behavior tests for the anti-homogeneity rules, driven through buildAndCheck with the fixture system: the same layout used by two adjacent narrative units
 * (reported on the later slide / unit) and an equal-card grid (three or more equally sized, similarly built siblings in one row). Ordinary lists and the clean fixtures stay finding-free.
 */
import { describe, expect, test } from 'vitest';
import type { Finding } from '../src/types.ts';
import { fixtures, patchedWork, run } from './helpers.ts';

const ruleFindings = (findings: Finding[], ruleId: string) => findings.filter((finding) => finding.ruleId === ruleId);

const cover = (layout: string) => ({ unit: 'cover', layout, content: { title: '发布二点零', subtitle: '更快的搜索，更稳的同步' } });
const hero = (layout: string) => ({ unit: 'hero', layout, content: { headline: '发布二点零', lead: '更快的搜索，更稳的同步' } });
const statement = (layout: string) => ({ unit: 'statement', layout, content: { claim: '更快的搜索', support: '更稳的同步' } });
const features = (layout: string, count: number) => ({
  unit: 'features',
  layout,
  content: {
    heading: '三处改进',
    itemTitles: ['搜索更快', '同步更稳', '笔记更轻', '启动更快'].slice(0, count),
    itemBodies: ['全文搜索提速', '离线后自动合并', '体积减少一半', '冷启动不到一秒'].slice(0, count),
  },
});

describe('same layout used by adjacent units', () => {
  test('on slides is reported on the later slide only, as a warning', async () => {
    const path = await patchedWork('slides-clean', (work) => {
      work.sequence = [cover('stack'), cover('corner'), cover('corner'), statement('centered')];
    });
    const result = await run(path);
    expect(ruleFindings(result.report.findings, 'anti-homogeneity/adjacent-same-layout')).toEqual([
      expect.objectContaining({
        category: 'anti-homogeneity',
        severity: 'warning',
        location: expect.objectContaining({ slide: 3, unit: 'cover', layout: 'corner' }),
      }),
    ]);
    expect(result.exitCode).toBe(0);
  });

  test('on a web page is reported once for the later unit', async () => {
    const path = await patchedWork('web-clean', (work) => {
      work.sequence = [hero('split'), hero('split'), features('list', 3)];
    });
    const result = await run(path);
    expect(ruleFindings(result.report.findings, 'anti-homogeneity/adjacent-same-layout')).toEqual([
      expect.objectContaining({ severity: 'warning', location: expect.objectContaining({ unit: 'hero', layout: 'split' }), message: expect.stringContaining('第 2 项') }),
    ]);
  });

  test('different layouts of one unit and repeats separated by another unit are not reported', async () => {
    const slides = await run(
      await patchedWork('slides-clean', (work) => {
        work.sequence = [cover('stack'), cover('corner'), statement('centered'), cover('stack')];
      }),
    );
    expect(slides.report.findings).toEqual([]);
    const web = await run(
      await patchedWork('web-clean', (work) => {
        work.sequence = [hero('split'), features('list', 3), hero('split')];
      }),
    );
    expect(web.report.findings).toEqual([]);
  });

  test('a custom fragment between two units breaks the adjacency', async () => {
    const result = await run(
      await patchedWork('slides-clean', (work) => {
        work.sequence = [cover('stack'), { custom: '<p>幕间</p>', serves: '作品概念' }, cover('stack')];
      }),
    );
    expect(ruleFindings(result.report.findings, 'anti-homogeneity/adjacent-same-layout')).toEqual([]);
  });
});

describe('equal-card grid', () => {
  test('three equally sized, similarly built siblings in one row give a warning on the row', async () => {
    const result = await run(await patchedWork('web-clean', (work) => (work.sequence = [features('cards', 3)])));
    const hits = ruleFindings(result.report.findings, 'anti-homogeneity/equal-card-grid');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toEqual(
      expect.objectContaining({ category: 'anti-homogeneity', severity: 'warning', location: expect.objectContaining({ unit: 'features', layout: 'cards' }), message: expect.stringContaining('3') }),
    );
    expect(result.exitCode).toBe(0);
  });

  test('two cards, an ordinary list and unequal columns are not reported', async () => {
    for (const [layout, count] of [['cards', 2], ['list', 4], ['columns', 3]] as const) {
      const result = await run(await patchedWork('web-clean', (work) => (work.sequence = [features(layout, count)])));
      expect(ruleFindings(result.report.findings, 'anti-homogeneity/equal-card-grid')).toEqual([]);
    }
  });

  test('the clean fixtures stay finding-free', async () => {
    for (const name of ['clean', 'slides-clean', 'web-clean']) {
      expect((await run(fixtures.work(name))).report.findings).toEqual([]);
    }
  });
});
