import { Link, Navigate, useParams } from 'react-router-dom'
import SitePageLayout from '../components/SitePageLayout.jsx'
import PageCloseButton from '../components/PageCloseButton.jsx'
import ContentNotFound from '../components/ContentNotFound.jsx'
import useLocale from '../hooks/useLocale.js'
import PublicMeta from '../components/PublicMeta.jsx'
import {
  encodePublicFichePath,
  getPublicBrandLogo,
  getPublicCardImage,
  getPublicCardImagePosition,
  resolvePublicFicheItem,
} from '../utils/publicFiches.js'
import { getPublicBrandParcours } from '../utils/publicBrandParcours.js'
import { resolvePublicDetailCfaoLogo } from '../utils/resolveDetailCfaoLogo.js'
import DetailHeaderLogos from '../components/DetailHeaderLogos.jsx'

function PublicBrandNav({ publicSlug, items, activeSlug }) {
  if (items.length <= 1) return null

  return (
    <nav className="public-fiche-brands" aria-label="Choisir une marque ou une activité">
      {items.map((entry) => (
        <Link
          key={entry.slug}
          to={`/publics/${publicSlug}/${entry.slug}`}
          className={`chip${entry.slug === activeSlug ? ' active' : ''}`}
        >
          {entry.label}
        </Link>
      ))}
    </nav>
  )
}

export default function PublicFiche() {
  const { t: nfT } = useLocale('notFound')
  const { slug, brandSlug } = useParams()
  const { data, item } = resolvePublicFicheItem(slug, brandSlug)

  const pageBg = data ? getPublicCardImage(data.name, data.record?.img) : undefined
  const pageBgPosition = data ? getPublicCardImagePosition(data.name) : undefined
  const layoutProps = {
    navActive: 'publics',
    background: pageBg,
    backgroundPosition: pageBgPosition,
  }

  if (slug === 'techniciens' || slug === 'techniciens-voitures') {
    return <Navigate to="/publics/techniciens-vehicules-legers/toyota" replace />
  }

  if (!data) {
    return (
      <SitePageLayout {...layoutProps}>
        <main className="article-page formation-fiche-page public-fiche-page">
          <div className="container article-shell">
            <PageCloseButton to="/publics" ariaLabel={nfT.backToPublics} />
            <ContentNotFound
              eyebrow={nfT.eyebrow}
              title={nfT.publicTitle}
              lead={nfT.publicLead}
              primaryTo="/publics"
              primaryLabel={nfT.backToPublics}
              secondaryTo="/"
              secondaryLabel={nfT.backToHome}
            />
          </div>
        </main>
      </SitePageLayout>
    )
  }

  if (!item && data.items.length > 1) {
    return <Navigate to={`/publics/${slug}/${data.items[0].slug}`} replace />
  }

  if (!item) {
    return (
      <SitePageLayout {...layoutProps}>
        <main className="article-page formation-fiche-page public-fiche-page">
          <div className="container article-shell">
            <PageCloseButton to="/publics" ariaLabel={nfT.backToPublics} />
            <ContentNotFound
              eyebrow={nfT.eyebrow}
              title={nfT.sheetTitle}
              lead={nfT.sheetLead}
              primaryTo="/publics"
              primaryLabel={nfT.backToPublics}
              secondaryTo="/"
              secondaryLabel={nfT.backToHome}
            />
          </div>
        </main>
      </SitePageLayout>
    )
  }

  const record = data.record
  const ficheSrc = encodePublicFichePath(item.path)
  const brandLogo = getPublicBrandLogo(item.slug)
  const hasVariants = data.items.length > 1
  const pageTitle = data.name
  const parcoursNiv = getPublicBrandParcours(data.name, item.slug) ?? record?.niv
  const cfaoLogo = resolvePublicDetailCfaoLogo(slug, item.slug)

  return (
    <SitePageLayout {...layoutProps}>
      <main className="article-page formation-fiche-page public-fiche-page">
        <div className="container article-shell">
          <PageCloseButton
            to={{ pathname: '/', hash: 'publics' }}
            ariaLabel="Fermer et revenir aux publics à former"
          />

          <div className="article-main">
            <article className="article-sheet">
              <header className="article-header">
                <DetailHeaderLogos
                  cfaoLogo={cfaoLogo}
                  brandLogo={brandLogo}
                  brandLabel={brandLogo ? null : item.label}
                />
                <div className="news-tag news-tag--formation">Profil public</div>
                <PublicMeta
                  famille={record?.famille}
                  niv={parcoursNiv}
                  brandLabel={hasVariants ? item.label : null}
                />
                <h1>{pageTitle}</h1>
                {record?.meta && <p className="article-lead">{record.meta}</p>}
              </header>

              <PublicBrandNav
                publicSlug={slug}
                items={data.items}
                activeSlug={item.slug}
              />

              <figure className="formation-fiche-figure">
                <img
                  src={ficheSrc}
                  alt={`Profil ${data.name}${hasVariants ? ` — ${item.label}` : ''}`}
                />
              </figure>
            </article>
          </div>
        </div>
      </main>
    </SitePageLayout>
  )
}
