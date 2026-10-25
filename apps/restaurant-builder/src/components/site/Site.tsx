/* eslint-disable @next/next/no-img-element */
import type { Photo, SiteConfig } from '@/lib/schemas'
import { cssVariables, fontsFor, PRESETS } from '@/lib/render/themes'
import type { CSSProperties } from 'react'

/**
 * Renders a published restaurant site from its configuration. Pure function
 * of the config: no data fetching, no client JS beyond anchors.
 */
export function Site({ config, fallbackNote }: { config: SiteConfig; fallbackNote: string }) {
  const vars = cssVariables(config.brand, config.lang) as CSSProperties
  const fonts = fontsFor(config.brand.fontPair, config.lang)
  const preset = PRESETS[config.brand.preset]
  const photoById = new Map(config.photos.map((p) => [p.id, p]))
  const hero = config.design.heroPhotoId ? photoById.get(config.design.heroPhotoId) ?? null : null
  const gallery = config.design.galleryPhotoIds.map((id) => photoById.get(id)).filter((p): p is Photo => Boolean(p))
  const c = config.content
  const r = config.restaurant
  const style = { ...vars, '--display-weight': String(fonts.displayWeight) } as CSSProperties
  const classes = ['site', config.design.spacing === 'compact' ? 'compact' : '', preset.texture !== 'none' ? `texture-${preset.texture}` : '', 'has-callbar'].filter(Boolean).join(' ')

  const sections = config.design.sections.map((s) => {
    switch (s) {
      case 'hero':
        return <Hero key={s} config={config} hero={hero} />
      case 'about':
        return c.about ? (
          <section key={s} id="about" className="section about">
            <div className="wrap">
              <p className="eyebrow">{c.aboutTitle}</p>
              <h2 className="title">{c.displayName}</h2>
              <p className="text">{c.about}</p>
            </div>
          </section>
        ) : null
      case 'menu':
        return <Menu key={s} config={config} fallbackNote={fallbackNote} />
      case 'gallery':
        return gallery.length >= 2 ? (
          <section key={s} id="gallery" className="section gallery">
            <div className="wrap">
              <p className="eyebrow">{c.galleryTitle}</p>
              <div className="gallery-grid">
                {gallery.map((p) => (
                  <img key={p.id} src={p.url} alt={p.alt} width={p.width || undefined} height={p.height || undefined} loading="lazy" />
                ))}
              </div>
            </div>
          </section>
        ) : null
      case 'contact':
        return (
          <section key={s} id="contact" className="section contact">
            <div className="wrap">
              <p className="eyebrow">{c.contactTitle}</p>
              <h2 className="title">{c.displayName}</h2>
              <div className="contact-card">
                <dl>
                  <dt>{c.addressLabel}</dt>
                  <dd>{r.address}</dd>
                  <dt style={{ marginTop: '1rem' }}>{c.phoneLabel}</dt>
                  <dd>
                    <a href={r.telHref} dir="ltr" style={{ unicodeBidi: 'isolate' }}>
                      {r.phone}
                    </a>
                  </dd>
                </dl>
                <div className="actions">
                  <a className="btn btn-primary" href={r.telHref}>
                    {c.ctaCall}
                  </a>
                  <a className="btn btn-ghost" href={r.mapsUrl} target="_blank" rel="noopener noreferrer">
                    {c.ctaDirections}
                  </a>
                </div>
              </div>
            </div>
          </section>
        )
    }
  })

  return (
    <div className={classes} style={style}>
      <header className="nav">
        <div className="wrap">
          <a className="brand" href="#top">
            {r.logo ? <img src={r.logo.url} alt={c.displayName} /> : <span>{c.displayName}</span>}
          </a>
          <nav className="nav-links" aria-label="Sections">
            <a href="#menu">{c.ctaMenu}</a>
            {c.about && config.design.sections.includes('about') ? <a href="#about">{c.aboutTitle}</a> : null}
            <a href="#contact">{c.contactTitle}</a>
          </nav>
          <a className="btn btn-primary" href={r.telHref}>
            {c.ctaCall}
          </a>
        </div>
      </header>
      <main id="top">{sections}</main>
      <footer>
        <div className="wrap">
          <span>{c.displayName}</span>
          <span>{r.address}</span>
          <a href={r.telHref} dir="ltr">
            {r.phone}
          </a>
        </div>
      </footer>
      <div className="callbar" aria-hidden="false">
        <a className="btn btn-primary" href={r.telHref}>
          {c.ctaCall}
        </a>
        <a className="btn btn-ghost" href={r.mapsUrl} target="_blank" rel="noopener noreferrer">
          {c.ctaDirections}
        </a>
      </div>
    </div>
  )
}

function Hero({ config, hero }: { config: SiteConfig; hero: Photo | null }) {
  const c = config.content
  const r = config.restaurant
  const layout = hero ? config.design.heroLayout : 'typographic'
  const actions = (onDark: boolean) => (
    <div className="actions">
      <a className="btn btn-primary" href="#menu">
        {c.ctaMenu}
      </a>
      <a className={`btn ${onDark ? 'btn-on-dark' : 'btn-ghost'}`} href={r.mapsUrl} target="_blank" rel="noopener noreferrer">
        {c.ctaDirections}
      </a>
    </div>
  )
  if (layout === 'photo-full' && hero) {
    return (
      <section className="hero hero-full">
        <img src={hero.url} alt="" width={hero.width || undefined} height={hero.height || undefined} fetchPriority="high" />
        <div className="wrap">
          <h1>{c.headline}</h1>
          <p className="sub">{c.subheadline}</p>
          {actions(true)}
          <p className="meta">
            <span>{r.address}</span>
          </p>
        </div>
      </section>
    )
  }
  if (layout === 'photo-split' && hero) {
    return (
      <section className="hero hero-split">
        <div className="wrap">
          <div>
            <p className="eyebrow">{c.displayName}</p>
            <h1>{c.headline}</h1>
            <p className="sub">{c.subheadline}</p>
            {actions(false)}
          </div>
          <img src={hero.url} alt="" width={hero.width || undefined} height={hero.height || undefined} fetchPriority="high" />
        </div>
      </section>
    )
  }
  return (
    <section className="hero hero-type">
      <div className="wrap">
        {r.logo ? <img className="logo-lg" src={r.logo.url} alt={c.displayName} /> : <p className="eyebrow">{c.displayName}</p>}
        <h1>{c.headline}</h1>
        <p className="sub">{c.subheadline}</p>
        {actions(false)}
      </div>
    </section>
  )
}

function Menu({ config, fallbackNote }: { config: SiteConfig; fallbackNote: string }) {
  const c = config.content
  const m = config.menu
  return (
    <section id="menu" className={`section menu menu-${config.design.menuLayout}`}>
      <div className="wrap">
        <p className="eyebrow">{c.ctaMenu}</p>
        <h2 className="title">{c.menuTitle}</h2>
        {m.mode === 'images' ? (
          <>
            <p className="menu-note">{fallbackNote}</p>
            <div className="menu-images">
              {m.images.map((p) => (
                <img key={p.id} src={p.url} alt={p.alt} width={p.width || undefined} height={p.height || undefined} loading="lazy" />
              ))}
            </div>
          </>
        ) : (
          m.categories.map((cat) => (
            <div key={cat.id} className="cat">
              <h3>{cat.name}</h3>
              <ul className="items" style={{ listStyle: 'none', padding: 0 }}>
                {cat.items.map((it) => (
                  <li key={it.id} className="item">
                    <div>
                      <div className="name">{it.name}</div>
                      {it.description ? <p className="desc">{it.description}</p> : null}
                    </div>
                    {it.price ? (
                      <bdi className="price">
                        {it.price}
                        {m.currency && !it.price.includes(m.currency) ? ` ${m.currency}` : ''}
                      </bdi>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
