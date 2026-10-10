/*
 * Fonts actually used for glyphs, per text block, through the Chrome DevTools Protocol (CSS.getPlatformFontsForNode). Used by collectSnapshot, which stores the result as ElementSnapshot.fonts.
 * The page-side snapshot marks each text block with a temporary data-ds-probe attribute; this module finds the marked nodes via CDP, asks for their platform fonts and then removes the marks.
 * Chromium reports familyName and postScriptName from the font file's own name table (not the @font-face alias), isCustomFont = loaded through @font-face, glyphCount = glyphs drawn with it
 * (descendant text included). A glyph that a system font draws as fallback shows up as an extra entry with isCustomFont false; a glyph that no font has is counted under the primary font.
 */
import type { Page } from 'playwright';

export interface PlatformFont {
  familyName: string;
  postScriptName: string;
  isCustomFont: boolean;
  glyphCount: number;
}

export const PROBE_ATTRIBUTE = 'data-ds-probe';

export async function collectFontUsage(page: Page): Promise<Map<number, PlatformFont[]>> {
  const usage = new Map<number, PlatformFont[]>();
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
    const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: `[${PROBE_ATTRIBUTE}]` });
    for (const nodeId of nodeIds) {
      const { attributes } = await cdp.send('DOM.getAttributes', { nodeId });
      const probe = Number(attributes[attributes.indexOf(PROBE_ATTRIBUTE) + 1]);
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
      usage.set(
        probe,
        fonts.map((font) => ({
          familyName: font.familyName,
          postScriptName: font.postScriptName ?? '',
          isCustomFont: font.isCustomFont,
          glyphCount: font.glyphCount,
        })),
      );
    }
  } finally {
    await cdp.detach();
    await page.evaluate((attribute) => {
      for (const el of document.querySelectorAll(`[${attribute}]`)) el.removeAttribute(attribute);
    }, PROBE_ATTRIBUTE);
  }
  return usage;
}
