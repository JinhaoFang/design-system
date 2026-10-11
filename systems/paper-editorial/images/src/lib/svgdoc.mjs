/*
 * Standalone SVG document wrapper for the nine images: svgFile({w, h, title, body, P}) returns a complete file with a paper background rectangle and a plate mark
 * (single hairline inset from the edge, like the platemark of a copper engraving), so the picture is a plate with paper around it and never bleeds.
 * `inset` is the plate margin in px. Pass plate: false for drawings that supply their own frame.
 */
export function svgFile({ w, h, title, body, P, inset = 30, plate = true }) {
  const mark = plate
    ? `<rect x="${inset}" y="${inset}" width="${w - inset * 2}" height="${h - inset * 2}" fill="none" stroke="${P['ink-3']}" stroke-width="1.2"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img">\n<title>${title}</title>\n<rect width="${w}" height="${h}" fill="${P.paper}"/>\n${mark}\n${body}\n</svg>\n`;
}
