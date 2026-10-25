/** Small colour toolkit for themes and WCAG checks. */

export function isHex(v: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(v)
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

export function rgbToHex([r, g, b]: [number, number, number]): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 2 contrast ratio, 1..21. */
export function contrast(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  return rgbToHex([ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t])
}

/** Text colour (near-black or near-white) that reads on the given background. */
export function readableOn(bg: string): string {
  return contrast(bg, '#111111') >= contrast(bg, '#ffffff') ? '#111111' : '#ffffff'
}

/** Darken or lighten `color` until it has at least `ratio` contrast against `bg`. */
export function ensureContrast(color: string, bg: string, ratio = 4.5): string {
  if (contrast(color, bg) >= ratio) return color
  const towards = luminance(bg) > 0.5 ? '#000000' : '#ffffff'
  let out = color
  for (let t = 0.1; t <= 1; t += 0.1) {
    out = mix(color, towards, t)
    if (contrast(out, bg) >= ratio) return out
  }
  return towards
}
