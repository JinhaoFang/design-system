/*
 * Carrier registry: the single place that defines each carrier (web, slides, social), its label, its canvases and whether a work must name a canvas.
 * Canvases: social has three exact sizes; slides one fixed 1920x1080 stage; web two viewport widths (height is flow, so absent).
 * Per-carrier base values (body, spaceUnit, durationBase) are supplied by each system's token file under carrier.<id>.*; CARRIER_BASES lists them with their DTCG type.
 * RENDERABLE_CARRIERS lists carriers the pipeline can render today; slides renders through slides.ts, web through web.ts.
 */

export interface Canvas {
  width: number;
  height?: number;
}

export interface CarrierSpec {
  label: string;
  canvases: Record<string, Canvas>;
  canvasRequired: boolean;
}

export const SOCIAL_CANVASES = {
  'wechat-cover': { width: 900, height: 383 },
  xiaohongshu: { width: 1080, height: 1440 },
  square: { width: 1080, height: 1080 },
} as const;

export type SocialCanvas = keyof typeof SOCIAL_CANVASES;

export const CARRIERS = {
  web: {
    label: '展示型网页',
    canvases: { desktop: { width: 1440 }, mobile: { width: 390 } },
    canvasRequired: false,
  },
  slides: {
    label: 'HTML 幻灯片',
    canvases: { stage: { width: 1920, height: 1080 } },
    canvasRequired: false,
  },
  social: {
    label: '社交配图',
    canvases: SOCIAL_CANVASES,
    canvasRequired: true,
  },
} as const satisfies Record<string, CarrierSpec>;

export type CarrierId = keyof typeof CARRIERS;

export const CARRIER_IDS = Object.keys(CARRIERS) as CarrierId[];

export const RENDERABLE_CARRIERS: readonly CarrierId[] = ['social', 'slides', 'web'];

export const CARRIER_BASES = {
  body: { type: 'dimension', label: '正文字号' },
  spaceUnit: { type: 'dimension', label: '间距单位' },
  durationBase: { type: 'duration', label: '基准时长' },
} as const;

export type CarrierBase = keyof typeof CARRIER_BASES;

export function isCarrierId(value: unknown): value is CarrierId {
  return typeof value === 'string' && value in CARRIERS;
}
