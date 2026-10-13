/*
 * Recording behavior through buildAndCheck fixture pages. A local HTTP sink receives the page's first scroll and animation completion times.
 * The actual video pass starts with a small continuous scroll; audit passes start with a viewport-sized step, and static pages do not scroll.
 * Assertions cover delayed/split entrances, a cover leaving the viewport before its opacity finishes, off-screen exclusion, no-entrance fallback and bounded infinite waiting.
 */
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { stat } from 'node:fs/promises';
import { expect, test } from 'vitest';
import { patchedWork, run } from './helpers.ts';
import { editJson, NS, patchedSystem, tokensFile } from './system-helpers.ts';

interface Evidence {
  at: number;
  y: number;
  finished: { id: string; at: number }[];
  startedAt: number;
}

async function recordFixture(mode: 'entrance' | 'peel' | 'none' | 'infinite'): Promise<Evidence> {
  const evidence: Evidence[] = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url!, 'http://localhost');
    evidence.push(JSON.parse(url.searchParams.get('evidence')!));
    response.writeHead(200, { 'Access-Control-Allow-Origin': '*' });
    response.end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
    const script = `<script>
      const startedAt = performance.now();
      const finished = [];
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (...args) {
        const animation = animate.apply(this, args);
        const id = this.id;
        animation.finished.then(() => finished.push({ id, at: performance.now() }), () => {});
        return animation;
      };
      window.addEventListener('scroll', function firstScroll() {
        if (window.scrollY <= 0) return;
        window.removeEventListener('scroll', firstScroll);
        fetch(${JSON.stringify(endpoint)} + '?evidence=' + encodeURIComponent(JSON.stringify({ at: performance.now(), y: window.scrollY, finished, startedAt })));
      });
    </script>`;
    const style = `<style>:scope{font-family:var(--ds-font-body);color:var(--ds-color-ink);background:var(--ds-color-paper)} p{margin:0;font-size:var(--ds-type-body)} .line{height:var(--ds-space-1);background:var(--ds-color-accent)} .loop{animation:loop var(--ds-duration-base) infinite} @keyframes loop{from{opacity:0}to{opacity:1}}</style>`;
    const initial = mode === 'entrance'
      ? '<p id="title" data-ds-enter="rise" data-ds-order="0" data-ds-step="quick">发布二点零</p><div id="line" class="line" data-ds-enter="draw-x" data-ds-order="1" data-ds-step="quick" data-ds-wait="slow" data-ds-opacity-step="slow"></div>'
      : mode === 'peel'
        ? '<div id="cover" data-ds-enter="peel-up" data-ds-step="quick" style="position:absolute;top:0;height:var(--ds-space-1);width:100%;background:var(--ds-color-paper)"></div><p>发布二点零</p>'
        : `<p ${mode === 'infinite' ? 'class="loop"' : ''}>发布二点零</p>`;
    const work = await patchedWork('web-clean', (work) => {
      work.sequence = [{ custom: `${style}${script}${initial}<div style="height:1800px"></div><p class="loop">发布二点零</p><div style="height:900px"></div>`, serves: '验证录屏首屏等待和超时' }];
    });
    const systemDir = await patchedSystem((dir) => editJson(tokensFile(dir), (tokens) => {
      tokens.carrier.web.durationBase.$value.value = 600;
      tokens.$extensions[NS].entrance = { opacity: { step: 'slow', ease: 'settle' } };
    }));
    const result = await run(work, { systemDir });
    expect((await stat(result.artifacts.video!)).size).toBeGreaterThan(1000);
    const recording = evidence.filter((event) => event.y < 540);
    expect(recording).toHaveLength(1);
    return recording[0]!;
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('video scroll waits for delayed drawing and its longer opacity entrance, then holds the first screen', async () => {
  const evidence = await recordFixture('entrance');
  expect(evidence.finished.filter((event) => event.id === 'title')).toHaveLength(2);
  expect(evidence.finished.filter((event) => event.id === 'line')).toHaveLength(2);
  const end = Math.max(...evidence.finished.map((event) => event.at));
  expect(end - evidence.startedAt).toBeGreaterThanOrEqual(2400);
  expect(evidence.at - end).toBeGreaterThanOrEqual(800);
  expect(evidence.at - end).toBeLessThan(2500);
});

test('a page with no first-screen entrance uses the existing short hold and ignores off-screen infinite motion', async () => {
  const evidence = await recordFixture('none');
  expect(evidence.finished).toEqual([]);
  expect(evidence.at - evidence.startedAt).toBeGreaterThanOrEqual(800);
  expect(evidence.at - evidence.startedAt).toBeLessThan(2500);
});

test('a cover leaving the viewport still waits for its longer opacity entrance before the viewing hold', async () => {
  const evidence = await recordFixture('peel');
  expect(evidence.finished.filter((event) => event.id === 'cover')).toHaveLength(2);
  const end = Math.max(...evidence.finished.map((event) => event.at));
  expect(evidence.at - end).toBeGreaterThanOrEqual(800);
});

test('an infinite first-screen animation reaches the waiting limit and the recording still scrolls', async () => {
  const evidence = await recordFixture('infinite');
  expect(evidence.at - evidence.startedAt).toBeGreaterThanOrEqual(10800);
  expect(evidence.at - evidence.startedAt).toBeLessThan(13000);
});
