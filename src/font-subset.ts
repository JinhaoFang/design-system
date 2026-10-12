/*
 * Ships work-specific CJK font subsets, leaving the read-only source cache intact. Inputs: the final HTML, its viewports, manifest and used font entries.
 * Chromium collects decoded DOM text (including hidden content), plus CDP layout text for CSS counters, generated content and text transforms in screen and print media at both motion preferences and every slide.
 * Only OFL-1.1 fonts with a verified license without Reserved Font Names are modified: pinned official license texts live in font-subset-licenses.json;
 * manifest-local license texts are also accepted, with RFN declarations checked before the OFL PREAMBLE. Unknown licenses and Latin fonts stay byte-identical.
 * Preserves the original format, PostScript/style names, copyright, license names and all layout features; copies the complete license alongside each subset.
 * The checker reads the shipped cmap, never the source cmap. Subsetting failures are BuildError rather than silently falling back to full fonts.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import subsetFont from 'subset-font';
import licenses from './font-subset-licenses.json' with { type: 'json' };
import type { FontEntry, FontManifest } from './fonts.ts';
import { BuildError } from './types.ts';

async function subsetLicense(font: FontEntry, manifest: FontManifest): Promise<string | undefined> {
  if (!font.scripts.includes('cjk') || font.license.name !== 'OFL-1.1') return undefined;
  let text: string | undefined;
  if (font.license.file) {
    try {
      text = await readFile(join(manifest.dir, font.license.file), 'utf8');
    } catch {
      return undefined;
    }
  } else {
    text = (licenses as Record<string, string>)[font.license.url];
  }
  if (!text?.includes('SIL OPEN FONT LICENSE Version 1.1')) return undefined;
  const header = text.split(/\bPREAMBLE\b/)[0]!;
  return /reserved\s+font\s+names?/i.test(header) ? undefined : text;
}

async function pageCharacters(html: string, viewports: { width: number; height: number }[]): Promise<string> {
  const browser = await chromium.launch();
  const chars = new Set<string>();
  try {
    for (const reducedMotion of ['no-preference', 'reduce'] as const) {
      const context = await browser.newContext({ reducedMotion });
      await context.route('**/*', (route) => route.abort());
      const page = await context.newPage();
      await page.setContent(html.replace(/<html\b/, '<html data-render="static"'), { waitUntil: 'domcontentloaded' });
      const session = await context.newCDPSession(page);
      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        for (const media of ['screen', 'print'] as const) {
          await page.emulateMedia({ media });
          const count = await page.evaluate(() => (window as any).dsSlides?.count ?? 1);
          for (let slide = 0; slide < count; slide += 1) {
            await page.evaluate((index) => (window as any).dsSlides?.go(index), slide);
            const text = await page.evaluate(() => {
              const parts: string[] = [];
              const transform = (text: string, element: Element): void => {
                parts.push(text);
                const style = getComputedStyle(element);
                if (style.textTransform !== 'none') parts.push(text.toLocaleUpperCase(), text.toLocaleLowerCase());
              };
              const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
              let node: Node | null;
              while ((node = walker.nextNode())) {
                const parent = node.parentElement;
                if (parent && !parent.closest('script,style,noscript')) transform(node.textContent ?? '', parent);
              }
              for (const element of document.body.querySelectorAll('*')) {
                if (element.matches('script,style,noscript')) continue;
                if (element instanceof HTMLInputElement) transform(element.value, element);
                if (element instanceof HTMLImageElement) transform(element.alt, element);
              }
              return parts.join('');
            });
            for (const character of text) chars.add(character);
            const snapshot = await session.send('DOMSnapshot.captureSnapshot', { computedStyles: [] });
            for (const doc of snapshot.documents) {
              for (const index of doc.layout.text) {
                for (const character of snapshot.strings[index] ?? '') chars.add(character);
              }
            }
          }
        }
      }
      await context.close();
    }
    return [...chars].join('');
  } finally {
    await browser.close();
  }
}

export async function copyFonts(input: {
  fontCacheDir: string;
  fonts: FontEntry[];
  manifest: FontManifest;
  outDir: string;
  html: string;
  viewports: { width: number; height: number }[];
}): Promise<void> {
  const { fontCacheDir, fonts, manifest, outDir } = input;
  await mkdir(join(outDir, 'fonts'), { recursive: true });
  let characters: string | undefined;
  for (const font of fonts) {
    const source = join(fontCacheDir, font.file);
    let data: Buffer;
    try {
      data = await readFile(source);
    } catch {
      throw new BuildError([`本地字体缓存里没有字体文件：${source}（先运行「抓取字体」：pnpm ds fetch-fonts）`]);
    }
    const license = await subsetLicense(font, manifest);
    if (license) {
      characters ??= await pageCharacters(input.html, input.viewports);
      try {
        data = await subsetFont(data, characters, { preserveNameIds: [0, 1, 2, 3, 4, 5, 6, 13, 14] });
      } catch (error) {
        throw new BuildError([`字体加载失败：字体「${font.id}」子集化失败（${(error as Error).message}）`]);
      }
      await writeFile(join(outDir, 'fonts', `${font.id}.OFL.txt`), license);
    }
    await writeFile(join(outDir, 'fonts', font.file), data);
  }
}
