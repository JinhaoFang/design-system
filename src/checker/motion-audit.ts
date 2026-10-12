/*
 * Motion audit: records every animation a page starts so the motion rules can read plain data (getAnimations() forgets finished animations, so we write each one down when it begins).
 * installAnimationRecorder runs in the page before any script (Playwright addInitScript): it patches Element.prototype.animate, listens for animationstart/transitionrun and polls document.getAnimations()
 * every frame; each animation is serialized once into window.__dsAnimationLog as an AnimationRecord (location marks from data-ds-unit/layout/slot and data-ds-slide, selector, source, duration in ms,
 * the easings that actually shape the motion, the animated properties).
 * Easing facts: a CSS animation keeps its easing on the keyframes (timing easing is always "linear"), a script animation or a CSS transition on the timing; the last keyframe's easing is never used, so it is ignored.
 * auditMotion(browser, url, options) runs one audit pass: a fresh context (viewport, reducedMotion "no-preference" or "reduce"), recorder installed, page loaded and fonts ready, then options.step(page) drives the page
 * (scrolling, slide changes) and a short wait lets the last animations start; the records come back and the context closes.
 * Rules receive the two record lists as snapshot.motion = { animations (normal motion), reduced (reduced-motion pass) }.
 */
import type { Browser, Page } from 'playwright';

export interface AnimationRecord {
  slide?: number;
  unit?: string;
  layout?: string;
  slot?: string;
  selector: string;
  source: 'css-animation' | 'css-transition' | 'script';
  name?: string;
  durationMs: number | null;
  easings: string[];
  properties: string[];
}

export interface MotionSnapshot {
  animations: AnimationRecord[];
  reduced: AnimationRecord[];
}

export function installAnimationRecorder(): void {
  const log: unknown[] = [];
  (window as any).__dsAnimationLog = log;
  const seen = new WeakSet<object>();
  const reserved = new Set(['offset', 'easing', 'composite', 'computedOffset']);

  const describe = (el: Element): string => {
    const parts: string[] = [];
    let node: Element | null = el;
    while (node && node !== document.body) {
      const slot = node.getAttribute('data-ds-slot');
      const unit = node.getAttribute('data-ds-unit');
      if (unit) {
        parts.unshift(`${node.tagName.toLowerCase()}[data-ds-unit="${unit}"]`);
        break;
      }
      if (slot) parts.unshift(`${node.tagName.toLowerCase()}[data-ds-slot="${slot}"]`);
      else {
        const siblings = node.parentElement ? [...node.parentElement.children].filter((child) => child.tagName === node!.tagName) : [];
        parts.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(node) + 1})`);
      }
      node = node.parentElement;
    }
    return parts.join(' > ');
  };

  const note = (animation: Animation): void => {
    if (seen.has(animation)) return;
    seen.add(animation);
    const effect = animation.effect as KeyframeEffect | null;
    if (!effect || typeof effect.getKeyframes !== 'function' || !effect.target) return;
    const target = effect.target as Element;
    const timing = effect.getTiming();
    const keyframes = effect.getKeyframes();
    const isCssAnimation = typeof CSSAnimation !== 'undefined' && animation instanceof CSSAnimation;
    const isCssTransition = typeof CSSTransition !== 'undefined' && animation instanceof CSSTransition;
    const easings = new Set<string>();
    if (!isCssAnimation && timing.easing) easings.add(timing.easing);
    keyframes.slice(0, -1).forEach((keyframe) => {
      const easing = String(keyframe['easing'] ?? 'linear');
      if (isCssAnimation || easing !== 'linear') easings.add(easing);
    });
    const properties = new Set<string>();
    for (const keyframe of keyframes) for (const key of Object.keys(keyframe)) if (!reserved.has(key)) properties.add(key);
    const unit = target.closest('[data-ds-unit]');
    const slot = target.closest('[data-ds-slot]');
    const slide = target.closest('[data-ds-slide]');
    const record: Record<string, unknown> = {
      selector: describe(target),
      source: isCssAnimation ? 'css-animation' : isCssTransition ? 'css-transition' : 'script',
      durationMs: typeof timing.duration === 'number' ? timing.duration : null,
      easings: [...easings],
      properties: [...properties],
    };
    if (isCssAnimation) record['name'] = (animation as CSSAnimation).animationName;
    if (isCssTransition) record['name'] = (animation as CSSTransition).transitionProperty;
    if (unit) {
      record['unit'] = unit.getAttribute('data-ds-unit') ?? '';
      record['layout'] = unit.getAttribute('data-ds-layout') ?? '';
    }
    if (slot) record['slot'] = slot.getAttribute('data-ds-slot') ?? '';
    if (slide) record['slide'] = Number(slide.getAttribute('data-ds-slide'));
    log.push(record);
  };

  const original = Element.prototype.animate;
  Element.prototype.animate = function (this: Element, keyframes: any, options?: any) {
    const animation = original.call(this, keyframes, options);
    note(animation);
    return animation;
  };
  const noteTarget = (event: Event): void => {
    const target = event.target as Element | null;
    if (target && typeof target.getAnimations === 'function') target.getAnimations().forEach(note);
  };
  document.addEventListener('animationstart', noteTarget, true);
  document.addEventListener('transitionrun', noteTarget, true);
  const poll = (): void => {
    document.getAnimations().forEach(note);
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
}

export async function readAnimationRecords(page: Page): Promise<AnimationRecord[]> {
  return page.evaluate(() => [...((window as any).__dsAnimationLog ?? [])]);
}

export interface AuditOptions {
  viewport: { width: number; height: number };
  reducedMotion: 'no-preference' | 'reduce';
  step(page: Page): Promise<void>;
}

export async function auditMotion(browser: Browser, url: string, options: AuditOptions): Promise<AnimationRecord[]> {
  const context = await browser.newContext({ viewport: options.viewport, deviceScaleFactor: 1, reducedMotion: options.reducedMotion });
  try {
    await context.addInitScript(installAnimationRecorder);
    const page = await context.newPage();
    await page.goto(url);
    await page.evaluate(async () => {
      await Promise.allSettled([...document.fonts].map((face) => face.load()));
      await document.fonts.ready;
    });
    await options.step(page);
    await page.waitForTimeout(150);
    return await readAnimationRecords(page);
  } finally {
    await context.close();
  }
}
