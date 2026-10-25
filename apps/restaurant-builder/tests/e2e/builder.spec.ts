import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

const fx = (n: string) => path.join(__dirname, '../fixtures', n)

async function buildSite(page: Page, opts: { locale: 'ar' | 'en' | 'he'; siteLang: 'ar' | 'en' | 'he'; name: string; description?: string; photos?: string[] }) {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your Restaurant Website')
  await page.getByTestId(`lang-${opts.locale}`).click()
  await expect(page).toHaveURL(new RegExp(`/${opts.locale}$`))
  await expect(page.locator('html')).toHaveAttribute('dir', opts.locale === 'en' ? 'ltr' : 'rtl')
  await expect(page.locator('html')).toHaveAttribute('lang', opts.locale)

  await expect(page.getByTestId('builder-form')).toHaveAttribute('data-hydrated', 'true')
  await page.locator('#name').fill(opts.name)
  await page.getByTestId('menu-input').setInputFiles([fx('menu.jpg')])
  await expect(page.getByTestId('menu-item')).toHaveAttribute('data-status', 'done')
  await page.locator('#phone').fill('+972 50 123 4567')
  await page.locator('#address').fill('Ha-Yarkon 10, Tel Aviv')
  if (opts.description !== undefined) await page.locator('#description').fill(opts.description)
  if (opts.photos?.length) {
    await page.getByTestId('photos-input').setInputFiles(opts.photos.map(fx))
    await expect(page.locator('[data-testid="photos-item"][data-status="done"]')).toHaveCount(opts.photos.length)
  }
  await page.getByTestId(`site-lang-${opts.siteLang}`).click()
  await page.getByTestId('build').click()

  await expect(page).toHaveURL(/\/build\//)
  await expect(page.getByTestId('progress')).toBeVisible()
  await expect(page).toHaveURL(/\/done\//, { timeout: 90_000 })
  const url = await page.getByTestId('site-url').getAttribute('href')
  expect(url).toMatch(/^http:\/\/localhost:3100\/r\/[a-z0-9-]+$/)
  return url!
}

test('English builder → Arabic site with photos, full journey on a phone', async ({ page }) => {
  const url = await buildSite(page, { locale: 'en', siteLang: 'ar', name: 'Olive & Fire', description: 'A family restaurant serving traditional grilled food.', photos: ['food-landscape.jpg', 'food-portrait.jpg', 'interior.png'] })

  // Success screen essentials.
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your restaurant website is live!')
  await expect(page.getByTestId('owner-key')).toBeVisible()
  await expect(page.getByTestId('open-site')).toHaveAttribute('href', url)

  // The published site: RTL Arabic, verbatim prices, working call + directions, no overflow.
  await page.goto(url)
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('مشاوي على الفحم')
  await expect(page.locator('#menu')).toContainText('حمص')
  await expect(page.locator('#menu')).toContainText('120')
  await expect(page.locator('a[href="tel:+972501234567"]').first()).toBeVisible()
  await expect(page.locator('a[href^="https://www.google.com/maps/"]').first()).toBeAttached()
  expect(await page.locator('#gallery img').count()).toBeGreaterThanOrEqual(2)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
  await expect(page).toHaveTitle(/Olive & Fire/)
})

test('Arabic builder → Hebrew site; owner edits the phone number afterwards', async ({ page }) => {
  const url = await buildSite(page, { locale: 'ar', siteLang: 'he', name: 'Sea Breeze Fish', photos: ['food-portrait.jpg'] })
  await expect(page.getByRole('heading', { level: 1 })).toContainText('موقع مطعمك صار جاهز!')
  const slug = url.split('/r/')[1]

  await page.goto(url)
  await expect(page.locator('html')).toHaveAttribute('lang', 'he')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('#menu')).toContainText('דניס על הגריל')
  await expect(page.locator('#menu')).toContainText('98')

  // Edit with the key kept in this browser.
  await page.goto(`/ar/edit/${slug}`)
  await expect(page.locator('#e-phone')).toHaveValue('+972 50 123 4567')
  await page.locator('#e-phone').fill('+972 3 555 0199')
  await page.getByTestId('save').click()
  await expect(page.getByTestId('save')).toContainText('تم الحفظ')
  await page.goto(url)
  await expect(page.locator('a[href="tel:+97235550199"]').first()).toBeVisible()

  // A wrong key is refused.
  await page.goto(`/en/edit/${slug}#key=wrong-key`)
  await expect(page.getByTestId('edit-form').getByRole('alert')).toContainText('The edit key is wrong.')
})

test('Hebrew builder → English café site without photos stays premium (typographic hero)', async ({ page }) => {
  const url = await buildSite(page, { locale: 'he', siteLang: 'en', name: 'Café Noir' })
  await expect(page.getByRole('heading', { level: 1 })).toContainText('אתר המסעדה שלכם באוויר!')
  await page.goto(url)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await expect(page.locator('.hero-type')).toBeVisible()
  await expect(page.locator('#gallery')).toHaveCount(0)
  await expect(page.locator('#about')).toHaveCount(0)
  await expect(page.locator('#menu')).toContainText('Flat White')
  await expect(page.locator('#menu')).toContainText('38.50')
})

test('validation blocks an empty form and unknown sites are 404', async ({ page }) => {
  await page.goto('/en')
  await expect(page.getByTestId('builder-form')).toHaveAttribute('data-hydrated', 'true')
  await page.getByTestId('build').click()
  await expect(page.getByText('This field is required.').first()).toBeVisible()
  await expect(page.getByText('Please add at least one menu photo or PDF.')).toBeVisible()
  const res = await page.goto('/r/no-such-restaurant')
  expect(res?.status()).toBe(404)
  const health = await page.request.get('/api/health')
  expect((await health.json()).ok).toBe(true)
})
