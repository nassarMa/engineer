import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { processUpload, sniff, UploadError, cropBox } from '@/lib/uploads'

const fx = (n: string) => new Uint8Array(fs.readFileSync(path.join(__dirname, '../fixtures', n)))

describe('uploads', () => {
  it('sniffs real types regardless of declared mime', () => {
    expect(sniff(fx('menu.jpg'))).toBe('image/jpeg')
    expect(sniff(fx('interior.png'))).toBe('image/png')
    expect(sniff(fx('menu.pdf'))).toBe('application/pdf')
    expect(sniff(new TextEncoder().encode('<script>alert(1)</script>'))).toBeNull()
  })
  it('re-encodes images to webp within bounds and strips nothing needed', async () => {
    const out = await processUpload(fx('food-landscape.jpg'), 'photo')
    expect(out.mime).toBe('image/webp')
    expect(out.width).toBeLessThanOrEqual(1800)
    expect(out.key).toMatch(/\.webp$/)
  })
  it('keeps PDFs for menus only', async () => {
    const out = await processUpload(fx('menu.pdf'), 'menu')
    expect(out.mime).toBe('application/pdf')
    await expect(processUpload(fx('menu.pdf'), 'photo')).rejects.toBeInstanceOf(UploadError)
  })
  it('rejects garbage and oversize files', async () => {
    await expect(processUpload(new Uint8Array(100).fill(1), 'menu')).rejects.toMatchObject({ code: 'type' })
    await expect(processUpload(new Uint8Array(5 * 1024 * 1024), 'menu')).rejects.toMatchObject({ code: 'size' })
  })
  it('crops a logo box and refuses unusable boxes', async () => {
    const ok = await cropBox(fx('menu.jpg'), { x: 0.2, y: 0.05, w: 0.6, h: 0.1 })
    expect(ok?.width).toBeGreaterThan(96)
    expect(await cropBox(fx('menu.jpg'), { x: 0.4, y: 0.4, w: 0.02, h: 0.02 })).toBeNull()
  })
})
