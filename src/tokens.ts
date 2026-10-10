/*
 * Minimal DTCG 2025.10 resolver: reads a system's *.tokens.json, validates token types, and emits per-carrier CSS custom properties (--ds-*).
 * Supported $type: color, fontFamily, dimension, number. Ratios under ratio.type / ratio.space are multiplied by the carrier base (carrier.<name>.body / spaceUnit).
 * Aliases ("{a.b}"), $ref and $extends are rejected with an explicit error. Font ids are read from the design-system extension on fontFamily tokens.
 */
import { readFile } from 'node:fs/promises';
import { BuildError } from './types.ts';

const EXTENSION_KEY = 'io.github.jinhaofang.design-system';

export interface ResolvedTokens {
  cssVars: Record<string, string>;
  fontIds: string[];
}

interface Token {
  path: string[];
  type: string;
  value: any;
  fontId?: string;
}

function walk(node: any, path: string[], inheritedType: string | undefined, out: Token[], errors: string[]): void {
  const where = path.join('.') || '(root)';
  if (node === null || typeof node !== 'object' || Array.isArray(node)) {
    errors.push(`数值文件 ${where} 不是对象`);
    return;
  }
  for (const key of ['$ref', '$extends']) {
    if (key in node) errors.push(`数值文件 ${where} 使用了尚不支持的 ${key}`);
  }
  const type: string | undefined = node.$type ?? inheritedType;
  if ('$value' in node) {
    const children = Object.keys(node).filter((key) => !key.startsWith('$'));
    if (children.length) errors.push(`数值文件 ${where} 同时有 $value 和子项`);
    if (!type) {
      errors.push(`数值文件 ${where} 没有 $type`);
      return;
    }
    if (typeof node.$value === 'string' && /^\{.*\}$/.test(node.$value)) {
      errors.push(`数值文件 ${where} 使用了尚不支持的别名引用 ${node.$value}`);
      return;
    }
    const token: Token = { path, type, value: node.$value };
    const fontId = node.$extensions?.[EXTENSION_KEY]?.fontId;
    if (typeof fontId === 'string') token.fontId = fontId;
    out.push(token);
    return;
  }
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith('$')) continue;
    if (/[{}.]/.test(key)) {
      errors.push(`数值文件 ${where} 的名称 "${key}" 含有非法字符`);
      continue;
    }
    walk(child, [...path, key], type, out, errors);
  }
}

function num(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

function colorCss(value: any, where: string, errors: string[]): string | undefined {
  const { colorSpace, components } = value ?? {};
  if (typeof colorSpace !== 'string' || !Array.isArray(components) || components.length !== 3) {
    errors.push(`数值文件 ${where} 的颜色值格式不正确`);
    return undefined;
  }
  const [a, b, c] = components.map((x: number | 'none') => (x === 'none' ? 'none' : num(x)));
  const alpha = value.alpha !== undefined && value.alpha !== 1 ? ` / ${num(value.alpha)}` : '';
  switch (colorSpace) {
    case 'oklch':
    case 'oklab':
    case 'lab':
    case 'lch':
      return `${colorSpace}(${a} ${b} ${c}${alpha})`;
    case 'hsl':
      return `hsl(${a} ${b}% ${c}%${alpha})`;
    case 'srgb':
    case 'srgb-linear':
    case 'display-p3':
    case 'a98-rgb':
    case 'prophoto-rgb':
    case 'rec2020':
    case 'xyz-d50':
    case 'xyz-d65':
      return `color(${colorSpace} ${a} ${b} ${c}${alpha})`;
    default:
      errors.push(`数值文件 ${where} 的色彩空间 ${colorSpace} 尚不支持`);
      return undefined;
  }
}

function dimensionPx(value: any, where: string, errors: string[]): number | undefined {
  if (value?.unit === 'px' && typeof value.value === 'number') return value.value;
  errors.push(`数值文件 ${where} 目前只支持 px 单位的 dimension`);
  return undefined;
}

export async function loadTokens(tokensPath: string, carrier: string): Promise<ResolvedTokens> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(tokensPath, 'utf8'));
  } catch (error) {
    throw new BuildError([`无法读取体系数值文件：${tokensPath}（${(error as Error).message}）`]);
  }
  const errors: string[] = [];
  const tokens: Token[] = [];
  walk(raw, [], undefined, tokens, errors);

  const cssVars: Record<string, string> = {};
  const fontIds: string[] = [];
  const base: Record<string, number> = {};
  const ratios: { group: string; name: string; value: number }[] = [];

  for (const token of tokens) {
    const where = token.path.join('.');
    const [head, second, third] = token.path;
    if (head === 'carrier') {
      if (second === carrier && third && token.type === 'dimension') {
        const px = dimensionPx(token.value, where, errors);
        if (px !== undefined) base[third] = px;
      }
      continue;
    }
    if (head === 'ratio' && token.type === 'number' && (second === 'type' || second === 'space') && third) {
      ratios.push({ group: second, name: third, value: token.value });
      continue;
    }
    const cssName = `--ds-${token.path.join('-')}`;
    if (token.type === 'color') {
      const css = colorCss(token.value, where, errors);
      if (css) cssVars[cssName] = css;
    } else if (token.type === 'fontFamily') {
      const families: string[] = Array.isArray(token.value) ? token.value : [token.value];
      cssVars[cssName] = families.map((family) => `"${family}"`).join(', ');
      if (token.fontId) fontIds.push(token.fontId);
    } else if (token.type === 'dimension') {
      const px = dimensionPx(token.value, where, errors);
      if (px !== undefined) cssVars[cssName] = `${num(px)}px`;
    } else if (token.type === 'number') {
      cssVars[cssName] = num(token.value);
    } else {
      errors.push(`数值文件 ${where} 的 $type "${token.type}" 尚不支持`);
    }
  }

  for (const ratio of ratios) {
    const baseKey = ratio.group === 'type' ? 'body' : 'spaceUnit';
    const unit = base[baseKey];
    if (unit === undefined) {
      errors.push(`数值文件缺少载体 ${carrier} 的基准值 carrier.${carrier}.${baseKey}`);
      continue;
    }
    cssVars[`--ds-${ratio.group}-${ratio.name}`] = `${num(ratio.value * unit)}px`;
  }

  if (errors.length) throw new BuildError([...new Set(errors)]);
  return { cssVars, fontIds };
}
