/* Test helper: builds a work description holding one custom fragment (social xiaohongshu or slides), written to a temp file. Fragments use a .box element styled only from system variables unless the test overrides a property. */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { run, tempDir } from './helpers.ts';
import type { BuildResult } from '../src/build-and-check.ts';

export const BOX_CSS =
  'font-family:var(--ds-font-body);font-size:var(--ds-type-1);line-height:1.5;color:var(--ds-color-ink);background:var(--ds-color-paper);margin:0;padding:var(--ds-space-2);';

export function box(override = '', text = '发布二点零', extra = ''): string {
  return `<style>.box{${BOX_CSS}${override}}</style><p class="box">${text}</p>${extra}`;
}

export async function customWork(html: string, carrier: 'social' | 'slides' = 'social'): Promise<string> {
  const work = {
    system: 'mini',
    carrier,
    ...(carrier === 'social' && { canvas: 'xiaohongshu' }),
    concept: '定制片段的数值与对比度夹具',
    sequence: [{ custom: html, serves: '验证定制片段也被检查' }],
  };
  const path = join(await tempDir(), 'custom.json');
  await writeFile(path, JSON.stringify(work));
  return path;
}

export async function runCustom(
  html: string,
  rule?: string,
  carrier: 'social' | 'slides' = 'social',
): Promise<{ result: BuildResult; findings: BuildResult['report']['findings'] }> {
  const result = await run(await customWork(html, carrier));
  return { result, findings: result.report.findings.filter((finding) => !rule || finding.ruleId === rule) };
}
