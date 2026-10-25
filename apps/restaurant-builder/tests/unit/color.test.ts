import { describe, expect, it } from 'vitest'
import { contrast, ensureContrast, readableOn } from '@/lib/color'
import { buildPalette } from '@/lib/render/themes'
import { THEME_PRESETS } from '@/lib/schemas'

describe('contrast', () => {
  it('matches WCAG reference values', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 1)
  })
  it('ensureContrast reaches the target ratio', () => {
    const fixed = ensureContrast('#fbbf24', '#ffffff', 4.5)
    expect(contrast(fixed, '#ffffff')).toBeGreaterThanOrEqual(4.5)
  })
  it('readableOn picks a legible text colour', () => {
    expect(readableOn('#0f0e0c')).toBe('#ffffff')
    expect(readableOn('#fbf6ee')).toBe('#111111')
  })
})

describe('palettes', () => {
  it('every preset is readable with any accent the model might pick', () => {
    for (const preset of THEME_PRESETS) {
      for (const accent of ['#ffffff', '#000000', '#fbbf24', '#1b7fa3', 'not-a-colour']) {
        const pal = buildPalette({ preset, accent, cuisine: '', personality: 'warm', fontPair: 'modern-sans', rationale: '' })
        expect(contrast(pal.text, pal.bg), `${preset} text`).toBeGreaterThanOrEqual(7)
        expect(contrast(pal.muted, pal.bg), `${preset} muted`).toBeGreaterThanOrEqual(4.5)
        expect(contrast(pal.onPrimary, pal.primary), `${preset} button ${accent}`).toBeGreaterThanOrEqual(4.5)
        expect(contrast(pal.primary, pal.bg), `${preset} accent visible ${accent}`).toBeGreaterThanOrEqual(3)
      }
    }
  })
})
