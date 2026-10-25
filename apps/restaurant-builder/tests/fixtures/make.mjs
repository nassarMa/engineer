// Generates the image fixtures used by unit and e2e tests. Run: node tests/fixtures/make.mjs
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

const menuSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200">
  <rect width="900" height="1200" fill="#fbf6ee"/>
  <text x="450" y="120" text-anchor="middle" font-family="sans-serif" font-size="56" font-weight="700" fill="#2b1d14">Olive &amp; Fire</text>
  <text x="80" y="240" font-family="sans-serif" font-size="34" font-weight="700" fill="#b4472b">Starters</text>
  <text x="80" y="300" font-family="sans-serif" font-size="28" fill="#2b1d14">Hummus</text><text x="820" y="300" text-anchor="end" font-family="sans-serif" font-size="28" fill="#2b1d14">25</text>
  <text x="80" y="350" font-family="sans-serif" font-size="28" fill="#2b1d14">Falafel</text><text x="820" y="350" text-anchor="end" font-family="sans-serif" font-size="28" fill="#2b1d14">22</text>
  <text x="80" y="460" font-family="sans-serif" font-size="34" font-weight="700" fill="#b4472b">Grills</text>
  <text x="80" y="520" font-family="sans-serif" font-size="28" fill="#2b1d14">Shish Tawook</text><text x="820" y="520" text-anchor="end" font-family="sans-serif" font-size="28" fill="#2b1d14">68</text>
  <text x="80" y="570" font-family="sans-serif" font-size="28" fill="#2b1d14">Mixed Grill</text><text x="820" y="570" text-anchor="end" font-family="sans-serif" font-size="28" fill="#2b1d14">120</text>
</svg>`

function photo(w, h, a, b) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/><circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 4}" fill="rgba(255,255,255,0.35)"/></svg>`
}

await sharp(Buffer.from(menuSvg)).jpeg({ quality: 88 }).toFile(path.join(here, 'menu.jpg'))
await sharp(Buffer.from(photo(1600, 1000, '#c2410c', '#fbbf24'))).jpeg({ quality: 80 }).toFile(path.join(here, 'food-landscape.jpg'))
await sharp(Buffer.from(photo(900, 1300, '#0f766e', '#5eead4'))).jpeg({ quality: 80 }).toFile(path.join(here, 'food-portrait.jpg'))
await sharp(Buffer.from(photo(1200, 1200, '#4c1d95', '#f472b6'))).png().toFile(path.join(here, 'interior.png'))
await sharp(Buffer.from(photo(1000, 800, '#1e3a8a', '#93c5fd'))).jpeg({ quality: 80 }).toFile(path.join(here, 'exterior.jpg'))

// Minimal valid single-page PDF.
const pdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] >> endobj
trailer << /Root 1 0 R >>
%%EOF
`
fs.writeFileSync(path.join(here, 'menu.pdf'), pdf)
console.log('fixtures written to', here)
