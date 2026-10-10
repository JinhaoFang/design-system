declare module 'fontverter' {
  const fontverter: {
    convert(buffer: Uint8Array, to: 'sfnt' | 'woff' | 'woff2', from?: 'sfnt' | 'woff' | 'woff2'): Promise<Buffer>;
  };
  export default fontverter;
}
