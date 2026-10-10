/*
 * HTML page assembly for a social image: :root custom properties from the system's tokens, @font-face for the manifest fonts the system uses
 * (relative fonts/<file> URLs, so the artifact also opens straight from disk), and one fixed-size canvas holding the rendered units.
 */
import type { FontEntry } from './library.ts';

export interface PageInput {
  title: string;
  cssVars: Record<string, string>;
  fonts: FontEntry[];
  width: number;
  height: number;
  unitsHtml: string[];
}

const FORMATS: Record<string, string> = { woff2: 'woff2', woff: 'woff', otf: 'opentype', ttf: 'truetype' };

export function fontFaceCss(fonts: FontEntry[]): string {
  return fonts
    .map((font) => {
      const format = FORMATS[font.file.split('.').pop() ?? ''] ?? 'woff2';
      return `@font-face{font-family:"${font.family}";font-weight:${font.weight};src:url("fonts/${font.file}") format("${format}");}`;
    })
    .join('\n');
}

export function rootVarsCss(cssVars: Record<string, string>): string {
  return Object.entries(cssVars)
    .map(([name, value]) => `${name}:${value};`)
    .join('');
}

export function buildPage(input: PageInput): string {
  const fontFaces = fontFaceCss(input.fonts);
  const vars = rootVarsCss(input.cssVars);
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${input.title}</title>
<style>
${fontFaces}
:root{${vars}}
html,body{margin:0;padding:0}
.ds-canvas{width:${input.width}px;height:${input.height}px;overflow:hidden;position:relative}
</style>
</head>
<body data-carrier="social">
<main class="ds-canvas">
${input.unitsHtml.join('\n')}
</main>
</body>
</html>
`;
}
