/* Behavior tests for the exemplar library seams: validateExemplars (completeness check) and listExemplars (by source type), plus the CLI commands that wrap them. Libraries are built in temp dirs from a valid base record. */
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, test } from 'vitest';
import { listExemplars, validateExemplars } from '../src/exemplars.ts';
import { tempDir } from './helpers.ts';

const execFileAsync = promisify(execFile);
const cli = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'cli.ts');

function base(id: string): any {
  return {
    id,
    title: '示例范例',
    sourceType: 'external',
    sourceUrl: 'https://example.com/work',
    copyright: '示例工作室',
    carrier: 'web',
    systems: ['paper-editorial'],
    media: { kind: 'screenshot', status: 'present', file: 'screenshot.webp' },
    annotation: {
      highlights: '大面积留白与稳定的行距。',
      reasons: '段落节奏来自固定的基线网格。',
      scenes: '长文阅读、作品集。',
      materialAnchor: '暖白哑光纸上的油墨印刷',
      tonality: { 静动: 1, 疏密: 2, 冷暖: 4, 轻重: 2, 庄谐: 2 },
    },
    approval: { status: 'candidate' },
  };
}

async function makeLibrary(records: any[], options: { skipMedia?: string[] } = {}): Promise<string> {
  const library = await tempDir('ds-exemplars-');
  for (const record of records) {
    const dir = join(library, 'exemplars', record.id);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'exemplar.json'), JSON.stringify(record));
    if (record.media?.file && !options.skipMedia?.includes(record.id)) {
      await writeFile(join(dir, record.media.file), 'x');
    }
  }
  return library;
}

describe('validateExemplars', () => {
  test('accepts a complete candidate and counts it', async () => {
    const library = await makeLibrary([base('a-one')]);
    expect(await validateExemplars(library)).toEqual({ count: 1, issues: [] });
  });

  test.each([
    ['title', (r: any) => delete r.title],
    ['sourceUrl', (r: any) => delete r.sourceUrl],
    ['copyright', (r: any) => (r.copyright = '  ')],
    ['carrier', (r: any) => delete r.carrier],
    ['annotation.highlights', (r: any) => delete r.annotation.highlights],
    ['annotation.reasons', (r: any) => (r.annotation.reasons = '')],
    ['annotation.scenes', (r: any) => delete r.annotation.scenes],
    ['annotation.materialAnchor', (r: any) => delete r.annotation.materialAnchor],
    ['annotation.tonality', (r: any) => delete r.annotation.tonality],
    ['media', (r: any) => delete r.media],
    ['approval', (r: any) => delete r.approval],
  ])('names the exemplar and the field when %s is missing or blank', async (field, mutate) => {
    const record = base('b-two');
    mutate(record);
    const library = await makeLibrary([record]);
    const { issues } = await validateExemplars(library);
    expect(issues.some((issue) => issue.includes('b-two') && issue.includes(field))).toBe(true);
  });

  test('rejects an unknown source type, carrier or approval status', async () => {
    const record = base('c-three');
    record.sourceType = 'scraped';
    record.carrier = 'billboard';
    record.approval = { status: 'maybe' };
    const { issues } = await validateExemplars(await makeLibrary([record]));
    expect(issues.some((issue) => issue.includes('sourceType'))).toBe(true);
    expect(issues.some((issue) => issue.includes('carrier'))).toBe(true);
    expect(issues.some((issue) => issue.includes('approval.status'))).toBe(true);
  });

  test.each([
    ['a missing scale', (t: any) => delete t.冷暖],
    ['a value of 0', (t: any) => (t.静动 = 0)],
    ['a value of 6', (t: any) => (t.疏密 = 6)],
    ['a non-integer', (t: any) => (t.轻重 = 2.5)],
    ['an unknown scale', (t: any) => (t.快慢 = 3)],
  ])('rejects tonality with %s', async (_name, mutate) => {
    const record = base('d-four');
    mutate(record.annotation.tonality);
    const { issues } = await validateExemplars(await makeLibrary([record]));
    expect(issues.some((issue) => issue.includes('d-four') && issue.includes('tonality'))).toBe(true);
  });

  test('requires a present screenshot to exist on disk', async () => {
    const library = await makeLibrary([base('f-seven')], { skipMedia: ['f-seven'] });
    const { issues } = await validateExemplars(library);
    expect(issues.some((issue) => issue.includes('f-seven') && issue.includes('media'))).toBe(true);
  });

  test('requires media.file when media is present and rejects unknown kinds', async () => {
    const noFile = base('g-eight');
    delete noFile.media.file;
    const badKind = base('g-nine');
    badKind.media.kind = 'gif';
    const { issues } = await validateExemplars(await makeLibrary([noFile, badKind]));
    expect(issues.some((issue) => issue.includes('g-eight') && issue.includes('media.file'))).toBe(true);
    expect(issues.some((issue) => issue.includes('g-nine') && issue.includes('media.kind'))).toBe(true);
  });

  test('allows pending media on a candidate but not on an approved exemplar', async () => {
    const pending = base('h-ten');
    pending.media = { kind: 'screenshot', status: 'pending' };
    const approved = base('h-eleven');
    approved.media = { kind: 'screenshot', status: 'pending' };
    approved.approval = { status: 'approved', date: '2026-10-10' };
    const { issues } = await validateExemplars(await makeLibrary([pending, approved]));
    expect(issues.filter((issue) => issue.includes('h-ten'))).toEqual([]);
    expect(issues.some((issue) => issue.includes('h-eleven') && issue.includes('media'))).toBe(true);
  });

  test('requires an ISO date for approved and rejected, and none for candidate', async () => {
    const approvedNoDate = base('i-twelve');
    approvedNoDate.approval = { status: 'approved' };
    const rejectedBadDate = base('i-thirteen');
    rejectedBadDate.approval = { status: 'rejected', date: '10/10/2026' };
    const candidateDated = base('i-fourteen');
    candidateDated.approval = { status: 'candidate', date: '2026-10-10' };
    const approvedOk = base('i-fifteen');
    approvedOk.approval = { status: 'approved', date: '2026-10-10' };
    const { issues } = await validateExemplars(
      await makeLibrary([approvedNoDate, rejectedBadDate, candidateDated, approvedOk]),
    );
    for (const id of ['i-twelve', 'i-thirteen', 'i-fourteen']) {
      expect(issues.some((issue) => issue.includes(id) && issue.includes('approval.date'))).toBe(true);
    }
    expect(issues.filter((issue) => issue.includes('i-fifteen'))).toEqual([]);
  });

  test('does not require a source link for an original exemplar', async () => {
    const original = base('j-sixteen');
    original.sourceType = 'original';
    delete original.sourceUrl;
    const copy = base('j-seventeen');
    copy.sourceType = 'copy';
    delete copy.sourceUrl;
    const { issues } = await validateExemplars(await makeLibrary([original, copy]));
    expect(issues.filter((issue) => issue.includes('j-sixteen'))).toEqual([]);
    expect(issues.some((issue) => issue.includes('j-seventeen') && issue.includes('sourceUrl'))).toBe(true);
  });

  test('reports unreadable records and a missing exemplars directory instead of throwing', async () => {
    const library = await makeLibrary([base('k-eighteen')]);
    await mkdir(join(library, 'exemplars', 'k-nineteen'));
    await writeFile(join(library, 'exemplars', 'k-nineteen', 'exemplar.json'), '{ not json');
    await mkdir(join(library, 'exemplars', 'k-twenty'));
    const { issues } = await validateExemplars(library);
    expect(issues.some((issue) => issue.includes('k-nineteen'))).toBe(true);
    expect(issues.some((issue) => issue.includes('k-twenty'))).toBe(true);
    const empty = await tempDir('ds-exemplars-');
    expect((await validateExemplars(empty)).issues).toHaveLength(1);
  });

  test('requires the directory name to equal the id', async () => {
    const library = await makeLibrary([base('e-five')]);
    await mkdir(join(library, 'exemplars', 'e-six'));
    await writeFile(join(library, 'exemplars', 'e-six', 'exemplar.json'), JSON.stringify(base('e-five')));
    const { issues } = await validateExemplars(library);
    expect(issues.some((issue) => issue.includes('e-six') && issue.includes('id'))).toBe(true);
  });
});

describe('listExemplars', () => {
  async function mixedLibrary(): Promise<string> {
    const external = base('l-ext');
    const copy = base('l-copy');
    copy.sourceType = 'copy';
    const original = base('l-orig');
    original.sourceType = 'original';
    delete original.sourceUrl;
    const pending = base('l-pending');
    pending.media = { kind: 'screenshot', status: 'pending' };
    return makeLibrary([external, copy, original, pending]);
  }

  test('lists every exemplar when no source type is given, sorted by id', async () => {
    const entries = await listExemplars(await mixedLibrary());
    expect(entries.map((entry) => entry.id)).toEqual(['l-copy', 'l-ext', 'l-orig', 'l-pending']);
  });

  test('lists only external exemplars with the media files that would have to be removed', async () => {
    const library = await mixedLibrary();
    const entries = await listExemplars(library, 'external');
    expect(entries.map((entry) => entry.id)).toEqual(['l-ext', 'l-pending']);
    expect(entries[0]).toMatchObject({
      sourceType: 'external',
      sourceUrl: 'https://example.com/work',
      approvalStatus: 'candidate',
      mediaFile: join(library, 'exemplars', 'l-ext', 'screenshot.webp'),
    });
    expect(entries[1]!.mediaFile).toBeNull();
  });

  test('lists nothing for a source type with no exemplars', async () => {
    const library = await makeLibrary([base('m-one')]);
    expect(await listExemplars(library, 'original')).toEqual([]);
  });
});

describe('exemplar commands', () => {
  async function ds(...args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
    try {
      const { stdout, stderr } = await execFileAsync('node', [cli, ...args]);
      return { code: 0, stdout, stderr };
    } catch (error: any) {
      return { code: error.code, stdout: error.stdout, stderr: error.stderr };
    }
  }

  test('validate-exemplars exits 0 for a complete library and 1 with the problems on stderr otherwise', async () => {
    const good = await makeLibrary([base('n-good')]);
    const ok = await ds('validate-exemplars', '--library', good);
    expect(ok.code).toBe(0);
    expect(ok.stdout).toContain('1');

    const broken = base('n-bad');
    delete broken.title;
    const bad = await ds('validate-exemplars', '--library', await makeLibrary([broken]));
    expect(bad.code).toBe(1);
    expect(bad.stderr).toContain('n-bad');
    expect(bad.stderr).toContain('title');
  });

  test('list-exemplars --source external prints one tab-separated line per exemplar and --paths prints only existing media files', async () => {
    const library = await makeLibrary([base('o-ext'), { ...base('o-copy'), sourceType: 'copy' }]);
    const listed = await ds('list-exemplars', '--source', 'external', '--library', library);
    expect(listed.code).toBe(0);
    const lines = listed.stdout.trim().split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.split('\t').slice(0, 3)).toEqual(['o-ext', 'external', 'candidate']);

    const paths = await ds('list-exemplars', '--source', 'external', '--paths', '--library', library);
    expect(paths.stdout.trim()).toBe(join(library, 'exemplars', 'o-ext', 'screenshot.webp'));
  });

  test('list-exemplars rejects an unknown source type with exit 2', async () => {
    const result = await ds('list-exemplars', '--source', 'scraped', '--library', await makeLibrary([base('p-one')]));
    expect(result.code).toBe(2);
  });
});
