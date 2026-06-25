import { useMemo, useState } from 'react'
import SitePageLayout from '../components/SitePageLayout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import PreviewSection from '../components/PreviewSection.jsx'
import CardCarousel from '../components/CardCarousel.jsx'
import ArticleCard from '../components/ArticleCard.jsx'
import { ARTICLES } from '../data/articles/index.js'
import { NEWS_CATS } from '../data/index.js'

const newsTabs = NEWS_CATS.map((c) => ({
  id: c.id,
  label: c.label,
  count: c.id === 'all' ? ARTICLES.length : ARTICLES.filter((a) => a.category === c.id).length,
}))

const buTabs = [
  { id: 'Motors', label: 'Motors' },
  { id: 'Equipment', label: 'Equipment' },
  { id: 'Carrosserie', label: 'Carrosserie' },
  { id: 'Parts Motors', label: 'Parts Motors' },
].map((t) => ({
  ...t,
  count: ARTICLES.filter((a) => a.bu === t.id).length,
}))

const BRAND_FILTERS = ['Toutes', ...new Set(ARTICLES.map((a) => a.brand).filter(Boolean))].slice(0, 8)


export default function Actualites() {
  const [brandFilter, setBrandFilter] = useState('Toutes')

  const filteredByBrand = useMemo(() => {
    if (brandFilter === 'Toutes') return ARTICLES
    return ARTICLES.filter((a) => a.brand === brandFilter)
  }, [brandFilter])

  return (
    <SitePageLayout navActive="actualites">
      <div className="actualites-page">
      <PageHeader
        eyebrow="Le réseau, en mouvement"
        title={<>Sessions, certifications et retours <em>terrain</em>.</>}
        sub="L'actualité de l'Academy et du réseau CFAO Mobility, par BU, marque et pays."
      />

      <PreviewSection
        ix="à la une"
        title={<>Les <em>derniers</em> articles.</>}
        tabs={newsTabs}
        bgWord="news"
        bgWordSide="left"
      >
        {(active) => {
          const items = (
            active === 'all'
              ? filteredByBrand
              : filteredByBrand.filter((a) => a.category === active)
          ).slice(0, 9)

          return (
            <>
              <div className="article-filters">
                {BRAND_FILTERS.map((b) => (
                  <button
                    key={b}
                    type="button"
                    className={`pv-level-pill${brandFilter === b ? ' active' : ''}`}
                    onClick={() => setBrandFilter(b)}
                  >
                    {b}
                  </button>
                ))}
              </div>
              {items.length ? (
                <div className="article-grid">
                  {items.map((article) => (
                    <ArticleCard key={article.slug} article={article} />
                  ))}
                </div>
              ) : (
                <p className="empty-section">Aucun article pour ce filtre.</p>
              )}
            </>
          )
        }}
      </PreviewSection>

      <PreviewSection
        ix="par bu"
        title={<>Récents par <em>BU</em>.</>}
        tabs={buTabs}
        bgWord="bu"
        bgWordSide="right"
      >
        {(active) => {
          const items = ARTICLES.filter((a) => a.bu === active)
          return items.length ? (
            <CardCarousel className="card-carousel--news">
              {items.map((article) => (
                <ArticleCard key={article.slug} article={article} />
              ))}
            </CardCarousel>
          ) : (
            <p className="empty-section">Aucun article pour cette BU.</p>
          )
        }}
      </PreviewSection>

      </div>
    </SitePageLayout>
  )
}
