import { describe, expect, it } from 'vitest'
import { mapsUrl, slugify, telHref, scriptsIn } from '@/lib/text'

describe('slugify', () => {
  it('turns Latin names into slugs', () => {
    expect(slugify('Olive & Fire')).toBe('olive-and-fire')
    expect(slugify('  Café   Noir! ')).toBe('cafe-noir')
  })
  it('returns empty for non-Latin names so a random slug is used', () => {
    expect(slugify('مطعم الزيتون')).toBe('')
    expect(slugify('זית ואש')).toBe('')
  })
})

describe('telHref', () => {
  it('normalizes phone numbers', () => {
    expect(telHref('+972 50-123 4567')).toBe('tel:+972501234567')
    expect(telHref('050 123 4567')).toBe('tel:0501234567')
  })
  it('rejects things that are not phone numbers', () => {
    expect(telHref('12')).toBeNull()
    expect(telHref('call me')).toBeNull()
  })
})

describe('mapsUrl', () => {
  it('encodes the address', () => {
    expect(mapsUrl('Ha-Yarkon 10, Tel Aviv')).toBe('https://www.google.com/maps/search/?api=1&query=Ha-Yarkon%2010%2C%20Tel%20Aviv')
  })
})

describe('scriptsIn', () => {
  it('detects scripts', () => {
    expect(scriptsIn('شاورما Shawarma')).toEqual({ arabic: true, hebrew: false, latin: true })
    expect(scriptsIn('שווארמה')).toEqual({ arabic: false, hebrew: true, latin: false })
  })
})
