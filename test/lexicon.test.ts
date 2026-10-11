/* Behavior tests for the feeling-word lexicon seams: validateLexicon (completeness check), listLexicon (interpretations by status/system), and the CLI commands that wrap them. Libraries are built in temp dirs from a valid base entry. */
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, test } from 'vitest';
import { listLexicon, validateLexicon } from '../src/lexicon.ts';
import { tempDir } from './helpers.ts';

const execFileAsync = promisify(execFile);
const cli = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'cli.ts');

function interpretation(name: string, overrides: any = {}): any {
  return {
    name,
    description: '大面积留白，一屏只讲一件事，字放得很大，其余全部退后。',
    materialAnchor: '暖白哑光纸上的油墨印刷',
    tonality: { 静动: 1, 疏密: 1, 冷暖: 4, 轻重: 2, 庄谐: 2 },
    composition: { 跳跃率: '高', 版面率: '低', 图版率: '低' },
    recommendation: { system: 'paper-editorial' },
    samples: { status: 'pending' },
    approval: { status: 'candidate' },
    ...overrides,
  };
}

function entry(id: string, overrides: any = {}): any {
  return {
    id,
    word: '高级',
    phrasings: ['看起来高级一点', '要有高级感'],
    interpretations: [
      interpretation('留白极简'),
      interpretation('精密仪器感', {
        description: '像一台仪器的面板：细线、刻度、等宽小字，信息密但井然有序。',
        materialAnchor: '精密仪器的刻度与标注，放在暖灰白的纸面上',
        tonality: { 静动: 2, 疏密: 4, 冷暖: 2, 轻重: 3, 庄谐: 1 },
        composition: { 跳跃率: '中', 版面率: '高', 图版率: '低' },
        recommendation: { system: 'precision-industrial' },
      }),
    ],
    ...overrides,
  };
}

async function makeLibrary(entries: any[], exemplarIds: string[] = []): Promise<string> {
  const library = await tempDir('ds-lexicon-');
  await mkdir(join(library, 'lexicon'), { recursive: true });
  for (const item of entries) {
    await writeFile(join(library, 'lexicon', `${item.id}.json`), JSON.stringify(item));
  }
  for (const id of exemplarIds) {
    await mkdir(join(library, 'exemplars', id), { recursive: true });
    await writeFile(join(library, 'exemplars', id, 'exemplar.json'), JSON.stringify({ id }));
  }
  return library;
}

async function issuesOf(item: any, exemplarIds: string[] = []): Promise<string[]> {
  return (await validateLexicon(await makeLibrary([item], exemplarIds))).issues;
}

describe('validateLexicon', () => {
  test('accepts a complete candidate entry and counts it', async () => {
    const library = await makeLibrary([entry('gaoji')]);
    expect(await validateLexicon(library)).toEqual({ count: 1, issues: [] });
  });

  test.each([
    ['word', (e: any) => delete e.word],
    ['phrasings', (e: any) => (e.phrasings = [])],
    ['interpretations[0].name', (e: any) => delete e.interpretations[0].name],
    ['interpretations[0].description', (e: any) => (e.interpretations[0].description = ' ')],
    ['interpretations[0].materialAnchor', (e: any) => delete e.interpretations[0].materialAnchor],
    ['interpretations[0].tonality', (e: any) => delete e.interpretations[0].tonality],
    ['interpretations[0].composition', (e: any) => delete e.interpretations[0].composition],
    ['interpretations[0].recommendation', (e: any) => delete e.interpretations[0].recommendation],
    ['interpretations[0].samples', (e: any) => delete e.interpretations[0].samples],
    ['interpretations[0].approval', (e: any) => delete e.interpretations[0].approval],
  ])('names the entry and the field when %s is missing or blank', async (field, mutate) => {
    const item = entry('gaoji');
    mutate(item);
    const issues = await issuesOf(item);
    expect(issues.some((issue) => issue.includes('gaoji') && issue.includes(field))).toBe(true);
  });

  test('requires the file name to equal the id', async () => {
    const library = await makeLibrary([]);
    await writeFile(join(library, 'lexicon', 'daqi.json'), JSON.stringify(entry('gaoji')));
    const { issues } = await validateLexicon(library);
    expect(issues.some((issue) => issue.includes('daqi') && issue.includes('id'))).toBe(true);
  });

  test('requires at least two interpretations and distinct names and material anchors', async () => {
    const single = entry('one');
    single.interpretations = [single.interpretations[0]];
    expect((await issuesOf(single)).some((issue) => issue.includes('interpretations') && issue.includes('两'))).toBe(true);

    const sameName = entry('same-name');
    sameName.interpretations[1].name = sameName.interpretations[0].name;
    expect((await issuesOf(sameName)).some((issue) => issue.includes('same-name') && issue.includes('name'))).toBe(true);

    const sameAnchor = entry('same-anchor');
    sameAnchor.interpretations[1].materialAnchor = sameAnchor.interpretations[0].materialAnchor;
    expect((await issuesOf(sameAnchor)).some((issue) => issue.includes('same-anchor') && issue.includes('materialAnchor'))).toBe(true);
  });

  test.each([
    ['a missing scale', (t: any) => delete t.冷暖],
    ['a value of 0', (t: any) => (t.静动 = 0)],
    ['a value of 6', (t: any) => (t.疏密 = 6)],
    ['a non-integer', (t: any) => (t.轻重 = 2.5)],
    ['an unknown scale', (t: any) => (t.快慢 = 3)],
  ])('rejects tonality with %s', async (_name, mutate) => {
    const item = entry('tone');
    mutate(item.interpretations[1].tonality);
    const issues = await issuesOf(item);
    expect(issues.some((issue) => issue.includes('tone') && issue.includes('interpretations[1].tonality'))).toBe(true);
  });

  test.each([
    ['a missing ratio', (c: any) => delete c.图版率],
    ['an unknown level', (c: any) => (c.跳跃率 = '极高')],
    ['an unknown ratio', (c: any) => (c.留白率 = '低')],
  ])('rejects composition tendency with %s', async (_name, mutate) => {
    const item = entry('ratio');
    mutate(item.interpretations[0].composition);
    const issues = await issuesOf(item);
    expect(issues.some((issue) => issue.includes('ratio') && issue.includes('interpretations[0].composition'))).toBe(true);
  });
});

describe('validateLexicon recommendation, samples and approval', () => {
  test('accepts each seed system and a fully described temporary direction', async () => {
    const item = entry('rec-ok');
    item.interpretations[0].recommendation = { system: 'riso-print' };
    item.interpretations[1].recommendation = {
      system: '临时方向',
      borrowLayoutsFrom: 'paper-editorial',
      direction: '深色底配金属质感的细线与大号衬线字，节奏缓慢。',
    };
    expect(await issuesOf(item)).toEqual([]);
  });

  test.each([
    ['an unknown system', { system: 'neon-glow' }, 'recommendation.system'],
    ['a temporary direction without a system to borrow layouts from', { system: '临时方向', direction: '深色底。' }, 'recommendation.borrowLayoutsFrom'],
    ['a temporary direction without a description', { system: '临时方向', borrowLayoutsFrom: 'riso-print' }, 'recommendation.direction'],
  ])('rejects %s', async (_name, recommendation, field) => {
    const item = entry('rec-bad');
    item.interpretations[0].recommendation = recommendation;
    expect((await issuesOf(item)).some((issue) => issue.includes('rec-bad') && issue.includes(field))).toBe(true);
  });

  test('requires every referenced sample exemplar to exist and allows pending samples on any status', async () => {
    const item = entry('sam-one');
    item.interpretations[0].samples = { status: 'present', exemplars: ['real-one', 'ghost'] };
    item.interpretations[1].approval = { status: 'approved', date: '2026-10-11' };
    const issues = await issuesOf(item, ['real-one']);
    expect(issues.filter((issue) => issue.includes('samples'))).toHaveLength(1);
    expect(issues.some((issue) => issue.includes('interpretations[0].samples.exemplars') && issue.includes('ghost'))).toBe(true);
    expect(issues.some((issue) => issue.includes('real-one'))).toBe(false);
  });

  test('requires exemplar ids when samples are present and a known samples status', async () => {
    const empty = entry('sam-two');
    empty.interpretations[0].samples = { status: 'present', exemplars: [] };
    empty.interpretations[1].samples = { status: 'soon' };
    const issues = await issuesOf(empty);
    expect(issues.some((issue) => issue.includes('interpretations[0].samples.exemplars'))).toBe(true);
    expect(issues.some((issue) => issue.includes('interpretations[1].samples.status'))).toBe(true);
  });

  test('requires an ISO date for approved and rejected interpretations and none for candidates', async () => {
    const item = entry('app-one');
    item.interpretations[0].approval = { status: 'approved' };
    item.interpretations[1].approval = { status: 'candidate', date: '2026-10-11' };
    const issues = await issuesOf(item);
    expect(issues.some((issue) => issue.includes('interpretations[0].approval.date'))).toBe(true);
    expect(issues.some((issue) => issue.includes('interpretations[1].approval.date'))).toBe(true);

    const fine = entry('app-two');
    fine.interpretations[0].approval = { status: 'approved', date: '2026-10-11' };
    fine.interpretations[1].approval = { status: 'rejected', date: '2026-10-11' };
    expect(await issuesOf(fine)).toEqual([]);
    const unknown = entry('app-three');
    unknown.interpretations[0].approval = { status: 'maybe' };
    expect((await issuesOf(unknown)).some((issue) => issue.includes('approval.status'))).toBe(true);
  });

  test('reports unreadable files and a missing lexicon directory instead of throwing', async () => {
    const library = await makeLibrary([entry('ok-one')]);
    await writeFile(join(library, 'lexicon', 'broken.json'), '{ not json');
    const { count, issues } = await validateLexicon(library);
    expect(count).toBe(2);
    expect(issues.some((issue) => issue.includes('broken'))).toBe(true);
    const empty = await tempDir('ds-lexicon-');
    expect((await validateLexicon(empty)).issues).toHaveLength(1);
  });
});

describe('listLexicon', () => {
  async function mixedLibrary(): Promise<string> {
    const first = entry('aa-first', { word: '大气' });
    first.interpretations[0].approval = { status: 'approved', date: '2026-10-11' };
    first.interpretations[0].samples = { status: 'present', exemplars: ['real-one'] };
    const second = entry('bb-second', { word: '简约' });
    second.interpretations[1].recommendation = {
      system: '临时方向',
      borrowLayoutsFrom: 'riso-print',
      direction: '单色大色块加粗黑字。',
    };
    return makeLibrary([second, first], ['real-one']);
  }

  test('lists one row per interpretation sorted by entry id', async () => {
    const rows = await listLexicon(await mixedLibrary());
    expect(rows.map((row) => [row.id, row.interpretation])).toEqual([
      ['aa-first', '留白极简'],
      ['aa-first', '精密仪器感'],
      ['bb-second', '留白极简'],
      ['bb-second', '精密仪器感'],
    ]);
    expect(rows[0]).toMatchObject({ word: '大气', system: 'paper-editorial', approvalStatus: 'approved', samples: ['real-one'] });
    expect(rows[3]).toMatchObject({ system: '临时方向', approvalStatus: 'candidate', samples: [] });
  });

  test('filters by approval status and by recommended system', async () => {
    const library = await mixedLibrary();
    expect((await listLexicon(library, { status: 'approved' })).map((row) => row.id)).toEqual(['aa-first']);
    expect(await listLexicon(library, { status: 'rejected' })).toEqual([]);
    const temporary = await listLexicon(library, { system: '临时方向' });
    expect(temporary.map((row) => row.id)).toEqual(['bb-second']);
  });
});

describe('lexicon commands', () => {
  async function ds(...args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
    try {
      const { stdout, stderr } = await execFileAsync('node', [cli, ...args]);
      return { code: 0, stdout, stderr };
    } catch (error: any) {
      return { code: error.code, stdout: error.stdout, stderr: error.stderr };
    }
  }

  test('validate-lexicon exits 0 for a complete library and 1 with the problems on stderr otherwise', async () => {
    const ok = await ds('validate-lexicon', '--library', await makeLibrary([entry('good')]));
    expect(ok.code).toBe(0);
    expect(ok.stdout).toContain('1');

    const broken = entry('bad');
    delete broken.word;
    const bad = await ds('validate-lexicon', '--library', await makeLibrary([broken]));
    expect(bad.code).toBe(1);
    expect(bad.stderr).toContain('bad');
    expect(bad.stderr).toContain('word');
  });

  test('list-lexicon prints one tab-separated line per interpretation and honours --status and --system', async () => {
    const approved = entry('lst-one');
    approved.interpretations[0].approval = { status: 'approved', date: '2026-10-11' };
    const library = await makeLibrary([approved]);
    const all = await ds('list-lexicon', '--library', library);
    expect(all.code).toBe(0);
    const lines = all.stdout.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]!.split('\t').slice(0, 5)).toEqual(['lst-one', '高级', '留白极简', 'paper-editorial', 'approved']);

    const onlyApproved = await ds('list-lexicon', '--status', 'approved', '--library', library);
    expect(onlyApproved.stdout.trim().split('\n')).toHaveLength(1);
    const onlyIndustrial = await ds('list-lexicon', '--system', 'precision-industrial', '--library', library);
    expect(onlyIndustrial.stdout.trim().split('\t')[2]).toBe('精密仪器感');
  });

  test('list-lexicon rejects an unknown status or system with exit 2', async () => {
    const library = await makeLibrary([entry('lst-two')]);
    expect((await ds('list-lexicon', '--status', 'maybe', '--library', library)).code).toBe(2);
    expect((await ds('list-lexicon', '--system', 'neon-glow', '--library', library)).code).toBe(2);
  });
});
