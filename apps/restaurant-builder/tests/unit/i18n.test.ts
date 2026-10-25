import { describe, expect, it } from 'vitest'
import { DICTIONARIES, LOCALES, dirOf } from '@/lib/i18n'

describe('dictionaries', () => {
  it('cover every key in every language with non-empty text', () => {
    const keys = Object.keys(DICTIONARIES.en)
    for (const l of LOCALES) {
      for (const k of keys) expect((DICTIONARIES[l] as Record<string, string>)[k]?.trim(), `${l}.${k}`).toBeTruthy()
    }
  })
  it('uses the right script per language', () => {
    expect(/[؀-ۿ]/.test(DICTIONARIES.ar.build)).toBe(true)
    expect(/[֐-׿]/.test(DICTIONARIES.he.build)).toBe(true)
    expect(DICTIONARIES.en.build).toBe('Build My Website')
    expect(DICTIONARIES.ar.build).toBe('ابنِ موقع مطعمي')
    expect(DICTIONARIES.he.build).toBe('בנו את האתר שלי')
  })
  it('directions', () => {
    expect(dirOf('ar')).toBe('rtl')
    expect(dirOf('he')).toBe('rtl')
    expect(dirOf('en')).toBe('ltr')
  })
})
