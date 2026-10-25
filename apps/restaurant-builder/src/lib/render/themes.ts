import { contrast, ensureContrast, isHex, mix, readableOn } from '../color'
import type { Brand, Locale } from '../schemas'
import { THEME_PRESETS, FONT_PAIRS } from '../schemas'

/**
 * The design system the AI composes from. Presets fix the palette shape;
 * the brand accent is slotted in and corrected for contrast, so no
 * combination the model picks can produce unreadable text.
 */

export type Palette = {
  bg: string
  surface: string
  text: string
  muted: string
  primary: string
  onPrimary: string
  border: string
  heroOverlay: string
}

type PresetDef = {
  mode: 'light' | 'dark'
  bg: string
  surface: string
  text: string
  muted: string
  border: string
  radius: string
  defaultAccent: string
  texture: 'none' | 'grain' | 'lines'
}

export const PRESETS: Record<(typeof THEME_PRESETS)[number], PresetDef> = {
  'warm-rustic': { mode: 'light', bg: '#f7f1e8', surface: '#fffaf3', text: '#2b1d14', muted: '#6b5647', border: '#e6d8c6', radius: '14px', defaultAccent: '#b4472b', texture: 'grain' },
  'modern-minimal': { mode: 'light', bg: '#ffffff', surface: '#f6f6f6', text: '#111111', muted: '#5f5f5f', border: '#e5e5e5', radius: '8px', defaultAccent: '#111111', texture: 'none' },
  'elegant-dark': { mode: 'dark', bg: '#0f0e0c', surface: '#1a1815', text: '#f5efe6', muted: '#b7ac9c', border: '#2a2622', radius: '6px', defaultAccent: '#c9a24d', texture: 'lines' },
  'fresh-cafe': { mode: 'light', bg: '#fbfdf7', surface: '#ffffff', text: '#1f2a1f', muted: '#5c6b5c', border: '#dfe8d9', radius: '20px', defaultAccent: '#2f8f5b', texture: 'none' },
  'street-bold': { mode: 'light', bg: '#fff9e8', surface: '#ffffff', text: '#161616', muted: '#4a4a4a', border: '#161616', radius: '4px', defaultAccent: '#e23a2c', texture: 'none' },
  'coastal-light': { mode: 'light', bg: '#f4f9fb', surface: '#ffffff', text: '#12303d', muted: '#4f6f7c', border: '#d6e5ec', radius: '16px', defaultAccent: '#1b7fa3', texture: 'none' },
}

export function buildPalette(brand: Brand): Palette {
  const p = PRESETS[brand.preset]
  const accent = isHex(brand.accent) ? brand.accent : p.defaultAccent
  const { primary, onPrimary } = buttonColors(accent, p.bg)
  return {
    bg: p.bg,
    surface: p.surface,
    text: ensureContrast(p.text, p.bg, 7),
    muted: ensureContrast(p.muted, p.bg, 4.5),
    primary,
    onPrimary,
    border: p.border,
    heroOverlay: p.mode === 'dark' ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.45)',
  }
}

/**
 * A button needs a label that reads on it (4.5:1) and must itself stand out
 * from the page (3:1). Mid-tone accents such as amber satisfy neither with
 * pure black or white, so nudge the accent towards black or white, whichever
 * needs the smaller change.
 */
export function buttonColors(accent: string, bg: string): { primary: string; onPrimary: string } {
  const ok = (c: string) => contrast(c, readableOn(c)) >= 4.5 && contrast(c, bg) >= 3
  if (ok(accent)) return { primary: accent, onPrimary: readableOn(accent) }
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    for (const towards of ['#000000', '#ffffff']) {
      const c = mix(accent, towards, t)
      if (ok(c)) return { primary: c, onPrimary: readableOn(c) }
    }
  }
  const fallback = ensureContrast(accent, bg, 3)
  return { primary: fallback, onPrimary: readableOn(fallback) }
}

/** Google Fonts families per script. Every family listed covers the script it is used for. */
type FontSet = { display: string; body: string; displayWeight: number }

const FONT_TABLE: Record<(typeof FONT_PAIRS)[number], Record<Locale, FontSet>> = {
  'serif-classic': {
    en: { display: 'Playfair Display', body: 'Source Sans 3', displayWeight: 600 },
    ar: { display: 'Amiri', body: 'Cairo', displayWeight: 700 },
    he: { display: 'Frank Ruhl Libre', body: 'Heebo', displayWeight: 700 },
  },
  'modern-sans': {
    en: { display: 'Manrope', body: 'Inter', displayWeight: 700 },
    ar: { display: 'Tajawal', body: 'Cairo', displayWeight: 700 },
    he: { display: 'Rubik', body: 'Heebo', displayWeight: 600 },
  },
  'rounded-friendly': {
    en: { display: 'Nunito', body: 'Nunito', displayWeight: 800 },
    ar: { display: 'Baloo Bhaijaan 2', body: 'Cairo', displayWeight: 700 },
    he: { display: 'Varela Round', body: 'Assistant', displayWeight: 400 },
  },
  'bold-display': {
    en: { display: 'Oswald', body: 'Inter', displayWeight: 600 },
    ar: { display: 'Cairo', body: 'Cairo', displayWeight: 900 },
    he: { display: 'Secular One', body: 'Heebo', displayWeight: 400 },
  },
}

export function fontsFor(pair: Brand['fontPair'], lang: Locale): FontSet {
  return FONT_TABLE[pair][lang]
}

export function googleFontsHref(fonts: FontSet): string {
  const families = new Set<string>()
  families.add(`${fonts.display.replace(/ /g, '+')}:wght@${fonts.displayWeight}`)
  families.add(`${fonts.body.replace(/ /g, '+')}:wght@400;600`)
  return `https://fonts.googleapis.com/css2?${[...families].map((f) => `family=${f}`).join('&')}&display=swap`
}

export function cssVariables(brand: Brand, lang: Locale): Record<string, string> {
  const pal = buildPalette(brand)
  const p = PRESETS[brand.preset]
  const fonts = fontsFor(brand.fontPair, lang)
  return {
    '--bg': pal.bg,
    '--surface': pal.surface,
    '--text': pal.text,
    '--muted': pal.muted,
    '--primary': pal.primary,
    '--on-primary': pal.onPrimary,
    '--border': pal.border,
    '--hero-overlay': pal.heroOverlay,
    '--primary-soft': mix(pal.primary, pal.bg, 0.88),
    '--radius': p.radius,
    '--font-display': `'${fonts.display}', system-ui, sans-serif`,
    '--font-body': `'${fonts.body}', system-ui, sans-serif`,
  }
}
