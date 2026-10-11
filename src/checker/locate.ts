/* Shared helper for rules: the report Location of a snapshot element (unit/layout/slot from the data-ds-* marks plus its selector). */
import type { Location } from '../types.ts';
import type { ElementSnapshot } from './snapshot.ts';

export function locateElement(element: ElementSnapshot): Location {
  return {
    ...(element.unit !== undefined && { unit: element.unit }),
    ...(element.layout !== undefined && { layout: element.layout }),
    ...(element.slot !== undefined && { slot: element.slot }),
    selector: element.selector,
  };
}
