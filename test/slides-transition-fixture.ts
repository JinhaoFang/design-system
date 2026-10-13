/* Page-turn fixture preparation: copies mini into an isolated directory, adds token references and projection/shade tokens from the selected paper prototype, and marks existing slide text for entrance. */
import { copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fixtures } from './helpers.ts';
import { editJson, editText, patchedSystem, tokensFile } from './system-helpers.ts';

export function transitionSystem(): Promise<string> {
  return patchedSystem(async (dir) => {
    await copyFile(join(fixtures.system, '..', '..', 'slides', 'transition.json'), join(dir, 'slides.transition.json'));
    await editJson(tokensFile(dir), (json) => {
      json.color['page-shade'] = { $value: { ...json.color.ink.$value, alpha: 0.12 } };
      json.shadow.page = { $value: [{
        color: { colorSpace: 'srgb', components: [74 / 255, 56 / 255, 34 / 255], alpha: 0.5 },
        offsetX: { value: -18, unit: 'px' }, offsetY: { value: 0, unit: 'px' },
        blur: { value: 30, unit: 'px' }, spread: { value: -24, unit: 'px' },
      }] };
    });
    for (const path of ['statement/centered', 'closing/plain']) {
      await editText(join(dir, 'layouts', 'slides', `${path}.liquid`), (text) => text.replace('<h2 ', '<h2 data-ds-enter="rise" '));
    }
  });
}
