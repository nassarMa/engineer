import type { Brand, Content, Design, ExtractedMenu, Locale } from '../schemas'
import type { AiProvider, BrandContext, ContentContext, DesignContext, ExtractContext } from './types'

/**
 * Deterministic provider for tests and keyless local work. It never looks at
 * the uploaded bytes; it picks one of three restaurant styles from the name
 * and description, which lets the whole pipeline (including the price
 * integrity checks and the image fallback) run without an API key.
 */

type Tri = Record<Locale, string>
type FixtureItem = { name: Tri; description: Tri | null; price: string | null }
type Fixture = {
  style: 'grill' | 'cafe' | 'seafood'
  sourceLanguage: Locale
  currency: string
  colors: string[]
  brand: Omit<Brand, 'rationale'>
  categories: { name: Tri; items: FixtureItem[] }[]
  labels: Record<Locale, { headline: string; sub: string }>
}

const tri = (ar: string, en: string, he: string): Tri => ({ ar, en, he })

const GRILL: Fixture = {
  style: 'grill',
  sourceLanguage: 'ar',
  currency: '₪',
  colors: ['#b4472b', '#2b1d14'],
  brand: { cuisine: 'Middle Eastern grill', personality: 'warm', preset: 'warm-rustic', fontPair: 'serif-classic', accent: '#b4472b' },
  categories: [
    {
      name: tri('المقبلات', 'Starters', 'ראשונות'),
      items: [
        { name: tri('حمص', 'Hummus', 'חומוס'), description: tri('حمص بالطحينة وزيت الزيتون', 'Chickpeas with tahini and olive oil', 'חומוס עם טחינה ושמן זית'), price: '25' },
        { name: tri('متبل', 'Mutabal', 'מוטבל'), description: null, price: '28' },
        { name: tri('فلافل', 'Falafel', 'פלאפל'), description: null, price: '22' },
      ],
    },
    {
      name: tri('المشاوي', 'Grills', 'על האש'),
      items: [
        { name: tri('شيش طاووق', 'Shish Tawook', 'שישליק עוף'), description: tri('دجاج متبل مشوي على الفحم', 'Marinated chicken grilled over charcoal', 'עוף מתובל על גחלים'), price: '68' },
        { name: tri('كباب لحم', 'Lamb Kebab', 'קבב כבש'), description: null, price: '75' },
        { name: tri('مشاوي مشكلة', 'Mixed Grill', 'מעורב על האש'), description: tri('تشكيلة لحوم مع الخبز والسلطات', 'Assorted meats with bread and salads', 'מבחר בשרים עם לחם וסלטים'), price: '120' },
      ],
    },
    {
      name: tri('المشروبات', 'Drinks', 'שתייה'),
      items: [
        { name: tri('عصير ليمون بالنعناع', 'Lemon Mint Juice', 'לימונדה עם נענע'), description: null, price: '15' },
        { name: tri('شاي', 'Tea', 'תה'), description: null, price: '8' },
      ],
    },
  ],
  labels: {
    ar: { headline: 'مشاوي على الفحم بنكهة البيت', sub: 'أجواء عائلية دافئة وأطباق تقليدية تُحضّر يوميًا.' },
    en: { headline: 'Charcoal grills, the way home tastes', sub: 'A warm family place with traditional dishes made fresh every day.' },
    he: { headline: 'על האש, בטעם של בית', sub: 'מקום משפחתי וחם עם מנות מסורתיות שמוכנות טרי כל יום.' },
  },
}

const CAFE: Fixture = {
  style: 'cafe',
  sourceLanguage: 'en',
  currency: '₪',
  colors: ['#2f8f5b', '#1f2a1f'],
  brand: { cuisine: 'Specialty coffee and brunch', personality: 'fresh', preset: 'fresh-cafe', fontPair: 'rounded-friendly', accent: '#2f8f5b' },
  categories: [
    {
      name: tri('القهوة', 'Coffee', 'קפה'),
      items: [
        { name: tri('إسبريسو', 'Espresso', 'אספרסו'), description: null, price: '10' },
        { name: tri('فلات وايت', 'Flat White', 'פלאט וייט'), description: null, price: '16' },
        { name: tri('قهوة باردة', 'Cold Brew', 'קולד ברו'), description: tri('تُنقع 18 ساعة', 'Steeped for 18 hours', 'חליטה קרה של 18 שעות'), price: '18' },
      ],
    },
    {
      name: tri('الفطور', 'Breakfast', 'בוקר'),
      items: [
        { name: tri('توست أفوكادو', 'Avocado Toast', 'טוסט אבוקדו'), description: tri('خبز حبوب كاملة، أفوكادو، بيضة مسلوقة', 'Sourdough, smashed avocado, poached egg', 'מחמצת, אבוקדו מעוך, ביצה עלומה'), price: '48' },
        { name: tri('شكشوكة', 'Shakshuka', 'שקשוקה'), description: null, price: '46' },
        { name: tri('غرانولا بالزبادي', 'Granola Bowl', 'קערת גרנולה'), description: null, price: '38.50' },
      ],
    },
  ],
  labels: {
    ar: { headline: 'قهوة مختصة وفطور طوال اليوم', sub: 'مكان هادئ ومشرق لبداية يوم جميلة.' },
    en: { headline: 'Specialty coffee, all-day brunch', sub: 'A bright, calm corner for a good start to the day.' },
    he: { headline: 'קפה ייחודי ובראנץ׳ כל היום', sub: 'פינה בהירה ורגועה להתחלה טובה של היום.' },
  },
}

const SEAFOOD: Fixture = {
  style: 'seafood',
  sourceLanguage: 'he',
  currency: '₪',
  colors: ['#1b7fa3', '#12303d'],
  brand: { cuisine: 'Mediterranean seafood', personality: 'elegant', preset: 'coastal-light', fontPair: 'modern-sans', accent: '#1b7fa3' },
  categories: [
    {
      name: tri('من البحر', 'From the Sea', 'מהים'),
      items: [
        { name: tri('سمك دنيس مشوي', 'Grilled Sea Bream', 'דניס על הגריל'), description: tri('مع خضار موسمية', 'With seasonal vegetables', 'עם ירקות עונתיים'), price: '98' },
        { name: tri('كاليماري مقلي', 'Fried Calamari', 'קלמרי מטוגן'), description: null, price: '62' },
        { name: tri('شوربة سمك', 'Fish Soup', 'מרק דגים'), description: null, price: '54' },
      ],
    },
    {
      name: tri('سلطات', 'Salads', 'סלטים'),
      items: [
        { name: tri('سلطة يونانية', 'Greek Salad', 'סלט יווני'), description: null, price: '42' },
        { name: tri('سلطة الشيف', "Chef's Salad", 'סלט השף'), description: null, price: null },
      ],
    },
  ],
  labels: {
    ar: { headline: 'سمك طازج على شاطئ البحر', sub: 'مطبخ متوسطي خفيف بإطلالة على الميناء.' },
    en: { headline: 'Fresh fish by the water', sub: 'Light Mediterranean cooking with a view of the harbour.' },
    he: { headline: 'דגים טריים מול הים', sub: 'בישול ים‑תיכוני קליל עם נוף לנמל.' },
  },
}

function pickFixture(name: string, description: string): Fixture {
  const s = `${name} ${description}`.toLowerCase()
  if (/cafe|café|coffee|brunch|קפה|كافيه|قهوة|مقهى/.test(s)) return CAFE
  if (/fish|sea|harbou?r|דג|ים|سمك|بحر/.test(s)) return SEAFOOD
  return GRILL
}

const LABELS: Record<Locale, Omit<Content, 'displayName' | 'headline' | 'subheadline' | 'about' | 'seoTitle' | 'seoDescription' | 'categories'>> = {
  ar: { ctaCall: 'اتصل بنا', ctaDirections: 'الاتجاهات', ctaMenu: 'المنيو', menuTitle: 'المنيو', galleryTitle: 'الصور', contactTitle: 'تواصل معنا', aboutTitle: 'عن المطعم', addressLabel: 'العنوان', phoneLabel: 'الهاتف' },
  en: { ctaCall: 'Call us', ctaDirections: 'Directions', ctaMenu: 'Menu', menuTitle: 'Menu', galleryTitle: 'Gallery', contactTitle: 'Find us', aboutTitle: 'About', addressLabel: 'Address', phoneLabel: 'Phone' },
  he: { ctaCall: 'התקשרו', ctaDirections: 'ניווט', ctaMenu: 'תפריט', menuTitle: 'התפריט', galleryTitle: 'גלריה', contactTitle: 'איפה אנחנו', aboutTitle: 'עלינו', addressLabel: 'כתובת', phoneLabel: 'טלפון' },
}

export function createMockProvider(): AiProvider {
  return {
    name: 'mock',

    async extractMenu(_files, ctx: ExtractContext): Promise<ExtractedMenu> {
      const f = pickFixture(ctx.name, ctx.description)
      const unreadable = /unreadable/i.test(ctx.name)
      const src = f.sourceLanguage
      return {
        sourceLanguage: src,
        currency: f.currency,
        categories: unreadable
          ? []
          : f.categories.map((c, ci) => ({
              id: `c${ci + 1}`,
              name: c.name[src],
              items: c.items.map((it, ii) => ({
                id: `c${ci + 1}-${ii + 1}`,
                name: it.name[src],
                description: it.description ? it.description[src] : null,
                price: it.price,
                priceConfidence: it.price === null ? 'low' : 'high',
                nameConfidence: 'high',
              })),
            })),
        branding: { detectedName: ctx.name, logoDetected: false, logoDescription: null, colorsSeen: f.colors, logoBox: null },
        readability: unreadable ? 'unreadable' : 'good',
        notes: unreadable ? ['Mock: menu marked unreadable by name.'] : [],
      }
    },

    async brand(ctx: BrandContext): Promise<Brand> {
      const f = pickFixture(ctx.name, ctx.description)
      return { ...f.brand, rationale: `Mock provider picked the ${f.style} identity from the name and description.` }
    },

    async design(ctx: DesignContext): Promise<Design> {
      const photos = ctx.photos
      const hero = photos[0]
      const heroLayout = !hero ? 'typographic' : hero.width >= hero.height ? 'photo-full' : 'photo-split'
      const gallery = photos.slice(1).map((p) => p.id)
      const sections: Design['sections'] = ['hero']
      if (ctx.hasAbout) sections.push('about')
      sections.push('menu')
      if (gallery.length >= 2) sections.push('gallery')
      sections.push('contact')
      const itemCount = ctx.menu.categories.reduce((n, c) => n + c.items.length, 0)
      return {
        heroLayout,
        menuLayout: itemCount > 25 ? 'list' : 'cards',
        sections,
        heroPhotoId: hero?.id ?? null,
        galleryPhotoIds: gallery,
        spacing: 'comfortable',
        rationale: 'Mock provider: deterministic composition.',
      }
    },

    async content(ctx: ContentContext): Promise<Content> {
      const f = pickFixture(ctx.name, ctx.description)
      const lang = ctx.websiteLang
      const labels = f.labels[lang]
      return {
        displayName: ctx.name,
        headline: labels.headline,
        subheadline: labels.sub,
        about: ctx.description ? ctx.description : null,
        ...LABELS[lang],
        seoTitle: `${ctx.name} – ${labels.headline}`.slice(0, 60),
        seoDescription: labels.sub.slice(0, 155),
        categories: ctx.menu.categories.map((c, ci) => ({
          id: c.id,
          name: f.categories[ci]?.name[lang] ?? c.name,
          items: c.items.map((it, ii) => {
            const fx = f.categories[ci]?.items[ii]
            return { id: it.id, name: fx ? fx.name[lang] : it.name, description: it.description === null ? null : (fx?.description?.[lang] ?? it.description) }
          }),
        })),
      }
    },

    async judgeLogo() {
      return false
    },
  }
}
