import { LangPicker } from '@/components/builder/LangPicker'

const STEPS = [
  { label: 'Upload Menu', icon: <path d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" /> },
  { label: 'AI Builds', icon: <path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4L12 3zM5 17l.7 1.8L7.5 19.5l-1.8.7L5 22l-.7-1.8-1.8-.7 1.8-.7L5 17zM19 15l.9 2.1 2.1.9-2.1.9L19 21l-.9-2.1-2.1-.9 2.1-.9L19 15z" /> },
  { label: 'Get Your Website', icon: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 13h5" /></> },
]

/** Screen one: what this is, how easy it is, and which language to use. */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 pb-10 pt-8">
      <div className="rise mb-8 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent-deep">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" /> AI Restaurant Website Builder
        </span>
        <h1 className="mt-5 text-[34px] font-extrabold leading-[1.1] tracking-tight sm:text-5xl">Your Restaurant Website. Made Simple.</h1>
        <p className="mx-auto mt-4 max-w-md text-[17px] text-ink-soft">Upload your menu, add a few details, and let AI build your restaurant website.</p>
      </div>

      <ol className="rise rise-1 mb-8 grid grid-cols-3 gap-2" aria-label="How it works">
        {STEPS.map((s, i) => (
          <li key={s.label} className="card relative flex flex-col items-center gap-2 px-2 py-4 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ink text-white" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{s.icon}</svg>
            </span>
            <span className="text-[13px] font-bold leading-tight">{s.label}</span>
            {i < STEPS.length - 1 ? <span className="absolute -end-2.5 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-cream text-ink-soft sm:flex" aria-hidden="true">›</span> : null}
          </li>
        ))}
      </ol>

      <h2 className="mb-3 text-center text-sm font-bold uppercase tracking-wider text-ink-soft">
        <span lang="ar">اختر لغتك</span> · Choose your language · <span lang="he">בחרו שפה</span>
      </h2>
      <LangPicker />

      <p className="mt-auto pt-10 text-center text-sm text-ink-soft">
        Your menu. Your restaurant. Your website. Built with AI.
        <br />
        <span lang="ar" dir="rtl">من صورة المنيو لموقع مطعم احترافي.</span> · <span lang="he" dir="rtl">מתמונת התפריט לאתר מסעדה מקצועי.</span>
      </p>
    </main>
  )
}
