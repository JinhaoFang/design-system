/* Behavior tests for system validation (SYSTEM.md header and sections, the five required contents, token file structure, system units), driven through validateSystem and buildAndCheck. */
import { describe, expect, test } from 'vitest';
import { validateSystem } from '../src/build-and-check.ts';
import { fixtures } from './helpers.ts';
import { editJson, editText, patchedSystem, systemMd, tokensFile } from './system-helpers.ts';

const validate = (systemDir: string, libraryDir = fixtures.library) => validateSystem({ systemDir, libraryDir });

describe('a complete system', () => {
  test('passes validation', async () => {
    await expect(validate(fixtures.system)).resolves.toBeDefined();
  });
});

describe('SYSTEM.md header', () => {
  test.each([
    ['id', /^id: mini\n/m, /标识/],
    ['name', /^name: .*\n/m, /名称/],
    ['category', /^category: .*\n/m, /类别/],
    ['source', /^source: .*\n/m, /来源/],
    ['license', /^license: .*\n/m, /授权/],
    ['material-anchor', /^material-anchor: .*\n/m, /材质锚点/],
  ])('a missing %s field fails and names it', async (_field, pattern, message) => {
    const dir = await patchedSystem((d) => editText(systemMd(d), (t) => t.replace(pattern, '')));
    await expect(validate(dir)).rejects.toThrow(message);
    await expect(validate(dir)).rejects.toThrow(/SYSTEM\.md/);
  });

  test('empty scenarios fail', async () => {
    const dir = await patchedSystem((d) => editText(systemMd(d), (t) => t.replace('  - 测试「构建并检查」流程\n', '')));
    await expect(validate(dir)).rejects.toThrow(/适用场景/);
  });

  test('an unknown carrier fails and lists the known ones', async () => {
    const dir = await patchedSystem((d) => editText(systemMd(d), (t) => t.replace('  - social', '  - hologram')));
    await expect(validate(dir)).rejects.toThrow(/hologram[\s\S]*web/);
  });

  test.each([
    ['out of range', (t: string) => t.replace('cool-warm: 4', 'cool-warm: 6'), /冷—暖/],
    ['not an integer', (t: string) => t.replace('airy-dense: 2', 'airy-dense: 2.5'), /疏—密/],
    ['missing', (t: string) => t.replace(/^ {2}formal-playful: 2\n/m, ''), /庄—谐/],
  ])('a tone position that is %s fails and names the pair', async (_case, edit, message) => {
    const dir = await patchedSystem((d) => editText(systemMd(d), edit));
    await expect(validate(dir)).rejects.toThrow(message);
  });

  test('a file without a header fails', async () => {
    const dir = await patchedSystem((d) => editText(systemMd(d), (t) => t.slice(t.indexOf('# 夹具体系'))));
    await expect(validate(dir)).rejects.toThrow(/文件头/);
  });
});

describe('SYSTEM.md sections', () => {
  test.each(['意图', '材质锚点', '视觉语言', '动效语言', '结构骨架', '范例'])('a missing section %s fails and names it', async (name) => {
    const dir = await patchedSystem((d) =>
      editText(systemMd(d), (t) => t.replace(new RegExp(`^## ${name}\\n`, 'm'), '## 其他\n')),
    );
    await expect(validate(dir)).rejects.toThrow(new RegExp(`「${name}」`));
  });

  test.each(['色彩', '字体', '版面', '形态', '图像与画风', '识别符号'])('a missing visual-language part %s fails', async (name) => {
    const dir = await patchedSystem((d) =>
      editText(systemMd(d), (t) => t.replace(new RegExp(`^### ${name}\\n`, 'm'), '### 其他\n')),
    );
    await expect(validate(dir)).rejects.toThrow(new RegExp(`视觉语言[\\s\\S]*「${name}」`));
  });

  test('an empty section fails', async () => {
    const dir = await patchedSystem((d) =>
      editText(systemMd(d), (t) => t.replace('为测试服务：用最少的内容满足体系格式的全部必填项。\n', '')),
    );
    await expect(validate(dir)).rejects.toThrow(/「意图」[\s\S]*为空/);
  });

  test('headings inside code fences are not sections', async () => {
    const dir = await patchedSystem((d) =>
      editText(systemMd(d), (t) => t.replace(/^## 范例\n/m, '```\n## 范例\n```\n')),
    );
    await expect(validate(dir)).rejects.toThrow(/「范例」/);
  });
});

describe('the five required contents', () => {
  test('a missing material anchor in the body fails and says what and where', async () => {
    const dir = await patchedSystem((d) =>
      editText(systemMd(d), (t) => t.replace('暖白哑光纸上的油墨印刷。光从左上来，表面不反光，边缘柔和，色温偏暖。\n', '')),
    );
    await expect(validate(dir)).rejects.toThrow(/缺少材质锚点[\s\S]*正文章节「材质锚点」为空/);
  });

  test('a missing highlight moment fails', async () => {
    const dir = await patchedSystem((d) =>
      editText(systemMd(d), (t) => t.replace('标题在入场时带一点摩擦，缓缓停住。\n', '')),
    );
    await expect(validate(dir)).rejects.toThrow(/缺少高光时刻[\s\S]*动效语言/);
  });

  test('a missing motion section fails and says motion language is missing', async () => {
    const dir = await patchedSystem((d) =>
      editText(systemMd(d), (t) => t.slice(0, t.indexOf('## 动效语言')) + t.slice(t.indexOf('## 结构骨架'))),
    );
    await expect(validate(dir)).rejects.toThrow(/缺少动效语言/);
  });

  test('a duration ladder with fewer than two steps fails', async () => {
    const dir = await patchedSystem((d) =>
      editJson(tokensFile(d), (j) => {
        j.ratio.duration = { quick: { $value: 0.5 } };
      }),
    );
    await expect(validate(dir)).rejects.toThrow(/缺少时长阶梯[\s\S]*ratio\.duration/);
  });

  test('an empty easing set fails', async () => {
    const dir = await patchedSystem((d) =>
      editJson(tokensFile(d), (j) => {
        delete j.easing;
      }),
    );
    await expect(validate(dir)).rejects.toThrow(/缺少缓动集[\s\S]*easing/);
  });

  test('a missing Chinese font pairing in the token file fails', async () => {
    const dir = await patchedSystem((d) =>
      editJson(tokensFile(d), (j) => {
        delete j.font.cjk;
      }),
    );
    await expect(validate(dir)).rejects.toThrow(/缺少中文字体搭配[\s\S]*font\.cjk/);
  });

  test('a missing Chinese pairing note in SYSTEM.md fails', async () => {
    const dir = await patchedSystem((d) =>
      editText(systemMd(d), (t) => t.replace('#### 中文搭配', '#### 其他搭配')),
    );
    await expect(validate(dir)).rejects.toThrow(/缺少中文字体搭配[\s\S]*字体/);
  });

  test('no identity marks fails', async () => {
    const dir = await patchedSystem((d) =>
      editText(systemMd(d), (t) => t.replace(/- 左上角的细线章节标记\n- 页脚的小号序号\n/, '')),
    );
    await expect(validate(dir)).rejects.toThrow(/识别符号[\s\S]*1–3/);
  });

  test('more than three identity marks fails and counts them', async () => {
    const dir = await patchedSystem((d) =>
      editText(systemMd(d), (t) => t.replace('- 页脚的小号序号\n', '- 页脚的小号序号\n- 第三个\n- 第四个\n')),
    );
    await expect(validate(dir)).rejects.toThrow(/识别符号[\s\S]*4/);
  });

  test('a missing no-image plan fails', async () => {
    const dir = await patchedSystem((d) =>
      editText(systemMd(d), (t) => t.replace('#### 无图方案', '#### 有图方案')),
    );
    await expect(validate(dir)).rejects.toThrow(/缺少无图方案[\s\S]*图像与画风/);
  });

  test('every problem is reported in one failure, not only the first', async () => {
    const dir = await patchedSystem(async (d) => {
      await editText(systemMd(d), (t) => t.replace('#### 无图方案', '#### 有图方案').replace(/^id: mini\n/m, ''));
      await editJson(tokensFile(d), (j) => {
        delete j.easing;
      });
    });
    const error = await validate(dir).catch((e: Error) => e);
    expect((error as Error).message).toMatch(/标识/);
    expect((error as Error).message).toMatch(/无图方案/);
    expect((error as Error).message).toMatch(/缓动集/);
  });
});
