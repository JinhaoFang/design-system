/*
 * Token file (DTCG Format/Color Module 2025.10) parsing, structure validation and per-carrier CSS resolution. Our own small resolver; no aliases, $ref or $extends yet (rejected with an explicit error).
 * File layout (all names are fixed; unknown top-level groups are errors):
 *   color.<role...> color | font.<role> fontFamily (+ $extensions[NS].fontId, a font-list id; roles body and cjk are used) | easing.<name> cubicBezier
 *   ratio.type.<n> (x carrier body px) | ratio.space.<n> and ratio.radius.<n> (x spaceUnit px) | ratio.duration.<name> and ratio.stagger.<name> (x durationBase ms), all type number
 *   spring.<name>.{stiffness,damping,mass} number | shadow.<name> shadow (layers) | grain.max number 0-1
 *   motion.stampScale number > 1 (optional): initial scale for the stamp entrance, resolved without a carrier multiplier as --ds-motion-stampScale.
 *   carrier.<web|slides|social>.{body,spaceUnit (dimension px), durationBase (duration)}: the per-carrier base values
 *   root $extensions[NS].constraints: { lightAngleDeg, grainMax, accentBudget, composition.<carrier>.{jumpRate,layoutRate,imageRate: [min,max]} } for the checker
 * CSS custom properties: --ds-color-*, --ds-font-*, --ds-type-N, --ds-space-N, --ds-radius-N, --ds-duration-*, --ds-stagger-*, --ds-easing-*, --ds-spring-<name>-<param>, --ds-shadow-*, --ds-grain-max.
 * Entry points: readTokenFile (parse + structure), checkTokenRequirements (required contents, carriers, font ids), resolveForCarrier (CSS for one carrier), loadTokens (read + resolve).
 */
import { readFile } from 'node:fs/promises';
import { CARRIER_BASES, CARRIER_IDS, isCarrierId } from './carriers.ts';
import type { CarrierBase, CarrierId } from './carriers.ts';
import { BuildError } from './types.ts';

export const EXTENSION_KEY = 'io.github.jinhaofang.design-system';

export const RATIO_GROUPS = {
  type: { base: 'body', unit: 'px', label: '字阶比例' },
  space: { base: 'spaceUnit', unit: 'px', label: '间距倍数' },
  radius: { base: 'spaceUnit', unit: 'px', label: '圆角倍数' },
  duration: { base: 'durationBase', unit: 'ms', label: '时长阶梯' },
  stagger: { base: 'durationBase', unit: 'ms', label: '错峰间隔' },
} as const satisfies Record<string, { base: CarrierBase; unit: 'px' | 'ms'; label: string }>;

export type RatioGroup = keyof typeof RATIO_GROUPS;

const COLOR_SPACES = ['srgb', 'srgb-linear', 'display-p3', 'a98-rgb', 'prophoto-rgb', 'rec2020', 'xyz-d50', 'xyz-d65', 'oklch', 'oklab', 'lab', 'lch', 'hsl', 'hwb'];
const SPRING_PARAMS = ['stiffness', 'damping', 'mass'];
const WEIGHT_ALIASES: Record<string, number> = {
  thin: 100, hairline: 100, 'extra-light': 200, 'ultra-light': 200, light: 300, normal: 400, regular: 400, book: 400,
  medium: 500, 'semi-bold': 600, 'demi-bold': 600, bold: 700, 'extra-bold': 800, 'ultra-bold': 800, black: 900, heavy: 900,
};

export interface Token {
  path: string[];
  type: string;
  value: any;
  fontId?: string;
  css?: string;
  number?: number;
}

export type Range = [number, number];

export interface CompositionRanges {
  jumpRate: Range;
  layoutRate: Range;
  imageRate: Range;
}

export interface Constraints {
  lightAngleDeg: number;
  grainMax: number;
  accentBudget: number;
  composition: Partial<Record<CarrierId, CompositionRanges>>;
}

export interface ParsedTokens {
  tokens: Token[];
  bases: Partial<Record<CarrierId, Partial<Record<CarrierBase, number>>>>;
  constraints?: Constraints;
}

export interface ResolvedEntry {
  cssVar: string;
  type: string;
  css: string;
  number?: number;
}

export interface ResolvedTokens {
  carrier: CarrierId;
  cssVars: Record<string, string>;
  fontIds: string[];
  entries: ResolvedEntry[];
  constraints?: Constraints;
}

function num(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
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

function colorCss(value: any, where: string, errors: string[]): string | undefined {
  const { colorSpace, components } = value ?? {};
  if (!COLOR_SPACES.includes(colorSpace)) {
    errors.push(`数值文件 ${where} 的色彩空间 ${JSON.stringify(colorSpace)} 不受支持，可选：${COLOR_SPACES.join('、')}`);
    return undefined;
  }
  if (!Array.isArray(components) || components.length !== 3 || !components.every((x) => x === 'none' || isNumber(x))) {
    errors.push(`数值文件 ${where} 的颜色 components 需要 3 个数字或 "none"`);
    return undefined;
  }
  if (value.alpha !== undefined && !(isNumber(value.alpha) && value.alpha >= 0 && value.alpha <= 1)) {
    errors.push(`数值文件 ${where} 的 alpha 需在 0–1 之间`);
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
    case 'hwb':
      return `hwb(${a} ${b}% ${c}%${alpha})`;
    default:
      return `color(${colorSpace} ${a} ${b} ${c}${alpha})`;
  }
}

function dimensionPx(value: any, where: string, errors: string[]): number | undefined {
  if (value?.unit === 'px' && isNumber(value.value)) return value.value;
  errors.push(`数值文件 ${where} 目前只支持 px 单位的 dimension（{ "value": 数字, "unit": "px" }）`);
  return undefined;
}

function durationMs(value: any, where: string, errors: string[]): number | undefined {
  if ((value?.unit === 'ms' || value?.unit === 's') && isNumber(value.value)) return value.unit === 's' ? value.value * 1000 : value.value;
  errors.push(`数值文件 ${where} 的 duration 需要 { "value": 数字, "unit": "ms" 或 "s" }`);
  return undefined;
}

function shadowCss(value: any, where: string, errors: string[]): string | undefined {
  const layers = Array.isArray(value) ? value : [value];
  const parts: string[] = [];
  for (const [index, layer] of layers.entries()) {
    const at = `${where}[${index}]`;
    if (layer === null || typeof layer !== 'object') {
      errors.push(`数值文件 ${at} 的阴影层不是对象`);
      continue;
    }
    const color = colorCss(layer.color, `${at}.color`, errors);
    const x = dimensionPx(layer.offsetX, `${at}.offsetX`, errors);
    const y = dimensionPx(layer.offsetY, `${at}.offsetY`, errors);
    const blur = dimensionPx(layer.blur, `${at}.blur`, errors);
    const spread = dimensionPx(layer.spread, `${at}.spread`, errors);
    if (color !== undefined && x !== undefined && y !== undefined && blur !== undefined && spread !== undefined) {
      parts.push(`${layer.inset ? 'inset ' : ''}${num(x)}px ${num(y)}px ${num(blur)}px ${num(spread)}px ${color}`);
    }
  }
  return parts.length === layers.length && parts.length > 0 ? parts.join(', ') : undefined;
}

function normalize(token: Token, errors: string[]): void {
  const where = token.path.join('.');
  const { type, value } = token;
  if (type === 'color') {
    const css = colorCss(value, where, errors);
    if (css) token.css = css;
  } else if (type === 'fontFamily') {
    const families: unknown[] = Array.isArray(value) ? value : [value];
    if (families.length === 0 || !families.every((family) => typeof family === 'string' && family !== '')) {
      errors.push(`数值文件 ${where} 的 fontFamily 需要字符串或字符串数组`);
    } else token.css = families.map((family) => `"${family}"`).join(', ');
  } else if (type === 'fontWeight') {
    const weight = typeof value === 'string' ? WEIGHT_ALIASES[value] : value;
    if (isNumber(weight) && weight >= 1 && weight <= 1000) {
      token.number = weight;
      token.css = String(weight);
    } else errors.push(`数值文件 ${where} 的 fontWeight 需要 1–1000 的数字或标准别名`);
  } else if (type === 'dimension') {
    const px = dimensionPx(value, where, errors);
    if (px !== undefined) {
      token.number = px;
      token.css = `${num(px)}px`;
    }
  } else if (type === 'duration') {
    const ms = durationMs(value, where, errors);
    if (ms !== undefined) {
      token.number = ms;
      token.css = `${num(ms)}ms`;
    }
  } else if (type === 'cubicBezier') {
    const points: number[] = Array.isArray(value) && value.length === 4 && value.every(isNumber) ? value : [];
    if (points.length === 4 && points[0]! >= 0 && points[0]! <= 1 && points[2]! >= 0 && points[2]! <= 1) {
      token.css = `cubic-bezier(${points.map(num).join(', ')})`;
    } else errors.push(`数值文件 ${where} 的 cubicBezier 需要 4 个数字，且第 1、3 个在 0–1 之间`);
  } else if (type === 'number') {
    if (isNumber(value)) {
      token.number = value;
      token.css = num(value);
    } else errors.push(`数值文件 ${where} 的 number 需要数字`);
  } else if (type === 'shadow') {
    const css = shadowCss(value, where, errors);
    if (css) token.css = css;
  } else {
    errors.push(`数值文件 ${where} 的 $type "${type}" 尚不支持`);
  }
}

function expectType(token: Token, expected: string, errors: string[]): boolean {
  if (token.type === expected) return true;
  errors.push(`数值文件 ${token.path.join('.')} 的 $type 应为 ${expected}，当前为 ${token.type}`);
  return false;
}

function parseRange(value: unknown, where: string, min: number, max: number, errors: string[]): Range | undefined {
  const pair: number[] = Array.isArray(value) && value.length === 2 && value.every(isNumber) ? value : [];
  if (pair.length === 2 && pair[0]! <= pair[1]! && pair[0]! >= min && pair[1]! <= max) return [pair[0]!, pair[1]!];
  errors.push(`数值文件 ${where} 需为 [最小, 最大]，两个数都在 ${min}–${max} 之间且最小不超过最大`);
  return undefined;
}

function parseConstraints(raw: any, errors: string[]): Constraints | undefined {
  const where = `$extensions["${EXTENSION_KEY}"].constraints`;
  const data = raw?.$extensions?.[EXTENSION_KEY]?.constraints;
  if (data === undefined || data === null || typeof data !== 'object') {
    errors.push(`缺少检查约束：数值文件缺少 ${where}`);
    return undefined;
  }
  const before = errors.length;
  const bounded = (key: string, label: string, min: number, max: number): number => {
    const value = data[key];
    if (isNumber(value) && value >= min && value <= max) return value;
    errors.push(`缺少检查约束：数值文件 ${where}.${key}（${label}）需要 ${min}–${max} 之间的数字`);
    return 0;
  };
  const lightAngleDeg = bounded('lightAngleDeg', '光源方向', 0, 360);
  const grainMax = bounded('grainMax', '颗粒上限', 0, 1);
  const accentBudget = bounded('accentBudget', '强调色预算', 0, 1);
  const composition: Constraints['composition'] = {};
  for (const [carrier, ranges] of Object.entries<any>(data.composition ?? {})) {
    if (!isCarrierId(carrier)) {
      errors.push(`数值文件 ${where}.composition 的载体 "${carrier}" 不存在，可选：${CARRIER_IDS.join('、')}`);
      continue;
    }
    const at = `${where}.composition.${carrier}`;
    const jumpRate = parseRange(ranges?.jumpRate, `${at}.jumpRate（跳跃率）`, 1, 100, errors);
    const layoutRate = parseRange(ranges?.layoutRate, `${at}.layoutRate（版面率）`, 0, 1, errors);
    const imageRate = parseRange(ranges?.imageRate, `${at}.imageRate（图版率）`, 0, 1, errors);
    if (jumpRate && layoutRate && imageRate) composition[carrier] = { jumpRate, layoutRate, imageRate };
  }
  return errors.length > before ? undefined : { lightAngleDeg, grainMax, accentBudget, composition };
}

export function parseTokens(raw: unknown): { parsed: ParsedTokens; issues: string[] } {
  const errors: string[] = [];
  const tokens: Token[] = [];
  walk(raw, [], undefined, tokens, errors);
  const bases: ParsedTokens['bases'] = {};
  const valid: Token[] = [];

  for (const token of tokens) {
    const where = token.path.join('.');
    const [head, second, third] = token.path;
    const depth = token.path.length;
    let ok = true;
    if (head === 'color') {
      ok = depth >= 2 && expectType(token, 'color', errors);
    } else if (head === 'font') {
      ok = depth === 2 && expectType(token, 'fontFamily', errors);
      if (ok && !token.fontId) {
        errors.push(`数值文件 ${where} 缺少字体清单引用 $extensions["${EXTENSION_KEY}"].fontId`);
        ok = false;
      }
    } else if (head === 'easing') {
      ok = depth === 2 && expectType(token, 'cubicBezier', errors);
    } else if (head === 'ratio') {
      ok = depth === 3 && second !== undefined && second in RATIO_GROUPS && expectType(token, 'number', errors);
      if (ok && token.value < 0) {
        errors.push(`数值文件 ${where} 的倍数不能为负`);
        ok = false;
      }
    } else if (head === 'spring') {
      ok = depth === 3 && SPRING_PARAMS.includes(third ?? '') && expectType(token, 'number', errors);
    } else if (head === 'motion') {
      ok = depth === 2 && second === 'stampScale' && expectType(token, 'number', errors);
      if (ok && !(isNumber(token.value) && token.value > 1)) {
        errors.push(`数值文件 ${where} 需要大于 1 的有限数字（按下落定的起始放大倍数）`);
        ok = false;
      }
    } else if (head === 'shadow') {
      ok = depth === 2 && expectType(token, 'shadow', errors);
    } else if (head === 'grain') {
      ok = depth === 2 && second === 'max' && expectType(token, 'number', errors);
      if (ok && !(isNumber(token.value) && token.value >= 0 && token.value <= 1)) {
        errors.push(`数值文件 ${where} 需要 0–1 之间的数字`);
        ok = false;
      }
    } else if (head === 'carrier') {
      ok = depth === 3 && isCarrierId(second) && third !== undefined && third in CARRIER_BASES;
      if (ok) ok = expectType(token, CARRIER_BASES[third as CarrierBase].type, errors);
    } else {
      ok = false;
    }
    if (!ok && !errors.some((error) => error.startsWith(`数值文件 ${where} `))) {
      errors.push(`数值文件 ${where} 不在约定的位置上（顶层分组：color、font、easing、ratio、spring、motion、shadow、grain、carrier）`);
    }
    if (!ok) continue;
    normalize(token, errors);
    if (head === 'carrier' && token.number !== undefined) {
      const carrier = second as CarrierId;
      (bases[carrier] ??= {})[third as CarrierBase] = token.number;
    }
    valid.push(token);
  }

  const constraints = parseConstraints(raw, errors);
  const parsed: ParsedTokens = { tokens: valid, bases };
  if (constraints) parsed.constraints = constraints;
  return { parsed, issues: [...new Set(errors)] };
}

export async function readTokenFile(path: string): Promise<{ parsed?: ParsedTokens; issues: string[] }> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    return { issues: [`无法读取体系数值文件：${path}（${(error as Error).message}）`] };
  }
  const { parsed, issues } = parseTokens(raw);
  return { parsed, issues };
}

function under(parsed: ParsedTokens, head: string, second?: string): Token[] {
  return parsed.tokens.filter((token) => token.path[0] === head && (second === undefined || token.path[1] === second));
}

export interface TokenRequirementInput {
  carriers: CarrierId[];
  fontIds: ReadonlySet<string>;
}

export function checkTokenRequirements(parsed: ParsedTokens, input: TokenRequirementInput): string[] {
  const issues: string[] = [];
  if (under(parsed, 'color').length === 0) issues.push('缺少色彩角色：数值文件 color 分组里没有颜色');
  if (under(parsed, 'ratio', 'type').length < 2) issues.push('缺少字阶比例：数值文件 ratio.type 至少需要 2 档');
  if (under(parsed, 'ratio', 'space').length < 2) issues.push('缺少间距倍数：数值文件 ratio.space 至少需要 2 档');
  const ladder = under(parsed, 'ratio', 'duration').length;
  if (ladder < 2) issues.push(`缺少时长阶梯：数值文件 ratio.duration 至少需要 2 档，当前 ${ladder} 档`);
  if (under(parsed, 'easing').length === 0) issues.push('缺少缓动集：数值文件 easing 里没有缓动曲线');
  if (!parsed.tokens.some((token) => token.path.join('.') === 'font.cjk')) {
    issues.push('缺少中文字体搭配：数值文件缺少 font.cjk（中文字体，用 fontId 引用字体清单条目）');
  }
  for (const token of under(parsed, 'font')) {
    if (token.fontId && !input.fontIds.has(token.fontId)) {
      issues.push(`数值文件 ${token.path.join('.')} 引用的字体 "${token.fontId}" 不在字体清单里`);
    }
  }
  for (const carrier of input.carriers) {
    for (const [base, spec] of Object.entries(CARRIER_BASES)) {
      if (parsed.bases[carrier]?.[base as CarrierBase] === undefined) {
        issues.push(`缺少载体基准值：数值文件缺少 carrier.${carrier}.${base}（${spec.label}）`);
      }
    }
    if (parsed.constraints && !parsed.constraints.composition[carrier]) {
      issues.push(`缺少检查约束：数值文件缺少载体 ${carrier} 的构图比率范围 constraints.composition.${carrier}`);
    }
  }
  const grain = parsed.tokens.find((token) => token.path.join('.') === 'grain.max');
  if (grain?.number !== undefined && parsed.constraints && grain.number > parsed.constraints.grainMax) {
    issues.push(`数值文件 grain.max（${grain.number}）超过了检查约束的颗粒上限 grainMax（${parsed.constraints.grainMax}）`);
  }
  return issues;
}

export function resolveForCarrier(parsed: ParsedTokens, carrier: CarrierId): ResolvedTokens {
  const errors: string[] = [];
  const entries: ResolvedEntry[] = [];
  const fontIds: string[] = [];
  const bases = parsed.bases[carrier] ?? {};
  const push = (cssVar: string, type: string, css: string, number?: number) =>
    entries.push(number === undefined ? { cssVar, type, css } : { cssVar, type, css, number });

  for (const token of parsed.tokens) {
    const [head, second, third] = token.path;
    if (head === 'carrier' || token.css === undefined) continue;
    if (head === 'ratio') {
      const group = RATIO_GROUPS[second as RatioGroup];
      const base = bases[group.base];
      if (base === undefined) {
        errors.push(`数值文件缺少载体 ${carrier} 的基准值 carrier.${carrier}.${group.base}`);
        continue;
      }
      const value = Math.round(token.number! * base * 1000) / 1000;
      push(`--ds-${second}-${third}`, group.unit === 'px' ? 'dimension' : 'duration', `${num(value)}${group.unit}`, value);
    } else if (head === 'grain') {
      push('--ds-grain-max', 'number', token.css, token.number);
    } else {
      push(`--ds-${token.path.join('-')}`, token.type, token.css, token.number);
    }
    if (head === 'font' && token.fontId && !fontIds.includes(token.fontId)) fontIds.push(token.fontId);
  }
  if (errors.length) throw new BuildError([...new Set(errors)]);

  const cssVars = Object.fromEntries(entries.map((entry) => [entry.cssVar, entry.css]));
  const resolved: ResolvedTokens = { carrier, cssVars, fontIds, entries };
  if (parsed.constraints) resolved.constraints = parsed.constraints;
  return resolved;
}

export async function loadTokens(tokensPath: string, carrier: CarrierId): Promise<ResolvedTokens> {
  const { parsed, issues } = await readTokenFile(tokensPath);
  if (issues.length || !parsed) throw new BuildError(issues);
  return resolveForCarrier(parsed, carrier);
}
