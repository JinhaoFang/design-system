/* Behavior tests for the contrast rules (WCAG 2 AA text contrast; text over images asks for manual confirmation), driven through buildAndCheck with custom fragments. Expected ratios are worked examples from the WCAG formula. */
import { describe, expect, test } from 'vitest';
import { box, runCustom } from './custom-work.ts';

const LOW = 'contrast/insufficient';
const IMAGE = 'contrast/text-over-image';
const SMALL = 'font-size:16px;';
const PIXEL = 'data:image/svg+xml;utf8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2740%27 height=%2740%27%3E%3Crect width=%2740%27 height=%2740%27 fill=%27%23888%27/%3E%3C/svg%3E';

describe('contrast/insufficient', () => {
  test('text that blends into its background is an error with the measured ratio, located at the custom unit', async () => {
    const { result, findings } = await runCustom(box(`${SMALL}color:var(--ds-color-paper);`), LOW);
    expect(findings).toEqual([
      expect.objectContaining({
        category: 'contrast',
        severity: 'error',
        location: expect.objectContaining({ unit: 'custom' }),
        message: expect.stringMatching(/1\.00[\s\S]*4\.5/),
      }),
    ]);
    expect(result.exitCode).toBe(1);
  });

  test('the system ink on the system paper passes', async () => {
    const { findings } = await runCustom(box(), LOW);
    expect(findings).toEqual([]);
  });

  test('body text needs 4.5 and is not rounded: #767676 on white is 4.54 and passes, #777777 is 4.48 and fails', async () => {
    expect((await runCustom(box(`${SMALL}color:#767676;background:#fff;`), LOW)).findings).toEqual([]);
    expect((await runCustom(box(`${SMALL}color:#777777;background:#fff;`), LOW)).findings).toHaveLength(1);
  });

  test('large text only needs 3: #848484 on white is 3.7 and fails at 16px but passes at 24px and at 18.67px bold', async () => {
    const gray = 'color:#848484;background:#fff;';
    expect((await runCustom(box(`${SMALL}${gray}`), LOW)).findings).toHaveLength(1);
    expect((await runCustom(box(`font-size:24px;${gray}`), LOW)).findings).toEqual([]);
    expect((await runCustom(box(`font-size:18.67px;font-weight:700;${gray}`), LOW)).findings).toEqual([]);
    expect((await runCustom(box(`font-size:18px;font-weight:700;${gray}`), LOW)).findings).toHaveLength(1);
  });

  test('large text below 3 still fails', async () => {
    const { findings } = await runCustom(box('font-size:24px;color:#aaaaaa;background:#fff;'), LOW);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain('3');
  });

  test('semi-transparent text is blended over its background first: 50% black on white is 3.98, not 21', async () => {
    const { findings } = await runCustom(box(`${SMALL}color:rgba(0,0,0,0.5);background:#fff;`), LOW);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain('3.9');
  });

  test('the background is the nearest opaque ancestor: dark panel inside a white page is judged as dark', async () => {
    const html = `<style>.p{background:#111111;margin:0;padding:0}.t{${SMALL}color:#eeeeee;margin:0;padding:0}</style><div class="p"><p class="t">深色底上的浅色字</p></div>`;
    expect((await runCustom(html, LOW)).findings).toEqual([]);
  });

  test('translucent layers are composited down to the first opaque one', async () => {
    const html = `<style>.o{background:#ffffff;margin:0;padding:0}.m{background:rgba(0,0,0,0.6);margin:0;padding:0}.t{${SMALL}color:#444444;margin:0;padding:0}</style><div class="o"><div class="m"><p class="t">叠在半透明层上</p></div></div>`;
    const { findings } = await runCustom(html, LOW);
    expect(findings).toHaveLength(1);
  });

  test('with no background anywhere the page is white, so white text fails', async () => {
    const html = `<style>.t{${SMALL}color:#ffffff;margin:0;padding:0}</style><p class="t">白底白字</p>`;
    expect((await runCustom(html, LOW)).findings).toHaveLength(1);
  });

  test('every text element is checked, including inline elements and slide fragments', async () => {
    const html = `<style>.o{background:#fff;margin:0;padding:0;${SMALL}color:#000}</style><p class="o">正文 <span style="color:#cccccc">浅色强调</span></p>`;
    const { findings } = await runCustom(html, LOW, 'slides');
    expect(findings).toHaveLength(1);
  });
});

describe('contrast/text-over-image', () => {
  test('text over an image asks for manual confirmation as a warning and is not scored', async () => {
    const html = `<style>.s{position:relative;width:400px;height:200px;margin:0;padding:0}.s img{position:absolute;left:0;top:0;width:400px;height:200px}.s p{position:relative;margin:0;padding:0;${SMALL}color:#ffffff}</style><div class="s"><img src="${PIXEL}" alt=""><p>图上的字</p></div>`;
    const { result, findings } = await runCustom(html, IMAGE);
    expect(findings).toEqual([
      expect.objectContaining({
        category: 'contrast',
        severity: 'warning',
        location: expect.objectContaining({ unit: 'custom' }),
        message: expect.stringContaining('需人工确认'),
      }),
    ]);
    expect(result.report.findings.filter((f) => f.ruleId === LOW)).toEqual([]);
  });

  test('text on a background image or gradient asks for manual confirmation', async () => {
    const html = `<style>.s{background:linear-gradient(#fff,#000);margin:0;padding:0;${SMALL}color:#888888}</style><p class="s">渐变上的字</p>`;
    const { findings } = await runCustom(html, IMAGE);
    expect(findings).toHaveLength(1);
  });

  test('an image beside the text does not trigger it', async () => {
    const html = `<style>.s{display:flex;margin:0;padding:0;background:#fff}.s img{width:40px;height:40px}.s p{margin:0;padding:0;${SMALL}color:#000}</style><div class="s"><img src="${PIXEL}" alt=""><p>旁边的字</p></div>`;
    const { findings } = await runCustom(html, IMAGE);
    expect(findings).toEqual([]);
  });

  test('a warning alone leaves the exit status at 0', async () => {
    const html = `<style>.s{background:${'linear-gradient(var(--ds-color-paper),var(--ds-color-paper))'};margin:0;padding:var(--ds-space-2);font-family:var(--ds-font-body);font-size:var(--ds-type-1);color:var(--ds-color-ink)}</style><p class="s">只有人工确认的警告</p>`;
    const { result } = await runCustom(html);
    expect(result.report.findings.map((f) => f.ruleId)).toEqual([IMAGE]);
    expect(result.exitCode).toBe(0);
  });
});
