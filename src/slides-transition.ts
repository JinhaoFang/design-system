/*
 * Optional system declaration <system>/slides.transition.json: {duration, easing, shadow, shadeColor, retreat}, each a CSS custom-property name from that system's tokens.
 * duration: --ds-duration-*; easing: --ds-easing-*; shadow: --ds-shadow-* (left-edge projection); shadeColor: --ds-color-* (alpha carries darkness); retreat: --ds-space-* (px).
 * No declaration means instant page changes. Unknown fields, missing fields and references of the wrong type fail the build before rendering.
 * The page embeds references rather than copied visual values: runtime reads computed properties when turning, and the motion audit checks the actual duration/easing used.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ResolvedTokens } from './tokens.ts';
import { BuildError } from './types.ts';

export interface SlidesTransition {
  duration: string;
  easing: string;
  shadow: string;
  shadeColor: string;
  retreat: string;
}

export async function loadSlidesTransition(systemDir: string, tokens: ResolvedTokens): Promise<SlidesTransition | undefined> {
  const path = join(systemDir, 'slides.transition.json');
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw new BuildError([`无法读取幻灯片翻页声明：${path}（${(error as Error).message}）`]);
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new BuildError(['slides.transition.json 需要对象']);
  const fields = {
    duration: ['--ds-duration-', 'duration'],
    easing: ['--ds-easing-', 'cubicBezier'],
    shadow: ['--ds-shadow-', 'shadow'],
    shadeColor: ['--ds-color-', 'color'],
    retreat: ['--ds-space-', 'dimension'],
  };
  const values = raw as Record<string, unknown>;
  const issues: string[] = [];
  for (const key of Object.keys(values)) if (!Object.hasOwn(fields, key)) issues.push(`slides.transition.json 不支持字段 ${key}`);
  for (const [key, [prefix, type]] of Object.entries(fields)) {
    const value = values[key];
    const entry = tokens.entries.find((entry) => entry.cssVar === value);
    if (typeof value !== 'string' || !value.startsWith(prefix!) || entry?.type !== type) issues.push(`slides.transition.json 的 ${key} 必须引用体系的 ${prefix}* 令牌`);
  }
  if (issues.length) throw new BuildError(issues);
  return raw as SlidesTransition;
}
