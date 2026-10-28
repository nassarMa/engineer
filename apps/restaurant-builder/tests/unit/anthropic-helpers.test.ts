import { describe, expect, it } from 'vitest'
import { chunkCategories, mergeExtractions } from '@/lib/ai/anthropic'
import type { ExtractedMenu } from '@/lib/schemas'

const page = (n: number, readability: ExtractedMenu['readability'], lang: ExtractedMenu['sourceLanguage']): ExtractedMenu => ({
  sourceLanguage: lang,
  currency: n === 1 ? null : '₪',
  categories: [{ id: 'c1', name: `Cat ${n}`, items: [{ id: 'c1-1', name: `Dish ${n}`, description: null, price: String(n * 10), priceConfidence: 'high', nameConfidence: 'high' }] }],
  branding: { detectedName: null, logoDetected: n === 2, logoDescription: n === 2 ? 'leaf' : null, colorsSeen: [`#00000${n}`], logoBox: n === 2 ? { page: 0, x: 0.1, y: 0.1, w: 0.3, h: 0.1 } : null },
  readability,
  notes: [`note ${n}`],
})

describe('mergeExtractions', () => {
  it('keeps ids unique across pages and takes the worst readability', () => {
    const merged = mergeExtractions([page(1, 'good', 'he'), page(2, 'partial', 'he')])
    expect(merged.categories.map((c) => c.id)).toEqual(['p1-c1', 'p2-c1'])
    expect(merged.categories.flatMap((c) => c.items.map((i) => i.id))).toEqual(['p1-c1-1', 'p2-c1-1'])
    expect(merged.categories.flatMap((c) => c.items.map((i) => i.price))).toEqual(['10', '20'])
    expect(merged.readability).toBe('partial')
    expect(merged.currency).toBe('₪')
    expect(merged.sourceLanguage).toBe('he')
    expect(merged.branding.logoBox?.page).toBe(1)
    expect(merged.notes).toEqual(['page 1: note 1', 'page 2: note 2'])
  })
  it('reports mixed languages', () => {
    expect(mergeExtractions([page(1, 'good', 'ar'), page(2, 'good', 'en')]).sourceLanguage).toBe('mixed')
  })
})

describe('chunkCategories', () => {
  it('groups whole categories up to the item budget', () => {
    const cats = [3, 10, 8, 2, 20].map((n, i) => ({ id: `c${i}`, name: `c${i}`, items: Array.from({ length: n }, (_, j) => ({ id: `c${i}-${j}`, name: 'x', description: null })) }))
    const chunks = chunkCategories(cats, 18)
    expect(chunks.map((ch) => ch.map((c) => c.id))).toEqual([['c0', 'c1'], ['c2', 'c3'], ['c4']])
  })
})
