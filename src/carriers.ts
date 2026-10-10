/*
 * Carrier definitions. Only the social-image carrier exists so far: three exact canvases (WeChat cover 900x383, Xiaohongshu 1080x1440, square 1080x1080).
 * Web and slides carriers are added by later tickets.
 */

export const SOCIAL_CANVASES = {
  'wechat-cover': { width: 900, height: 383 },
  xiaohongshu: { width: 1080, height: 1440 },
  square: { width: 1080, height: 1080 },
} as const;

export type SocialCanvas = keyof typeof SOCIAL_CANVASES;

export const SUPPORTED_CARRIERS = ['social'] as const;
