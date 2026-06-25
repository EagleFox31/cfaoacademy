import { useMemo, useCallback } from 'react'
import { useParams, useSearchParams, useLocation, useNavigate } from 'react-router-dom'
import SitePageLayout from '../components/SitePageLayout.jsx'
import useLocale from '../hooks/useLocale.js'
import PageCloseButton from '../components/PageCloseButton.jsx'
import ContentNotFound from '../components/ContentNotFound.jsx'
import { resolveSessionCardBadge } from '../utils/cardBrandBadge.js'
import {
  catalogFicheLogoContext,
  getCatalogFicheByCode,
  getCatalogFicheDescriptor,
  getFormationFicheDescriptor,
  getSessionByCode,
  resolveFormationFicheUrl,
} from '../utils/formationFiche.js'
import { resolveCatalogFormateurDisplay } from '../utils/catalogFormateur.js'
import { flagCdnUrl } from '../utils/sessionLieuFlag.js'
import { sessionsHomeReturnLink, hasSessionsReturn } from '../utils/sessionsReturn.js'
import { splitRouterTo } from '../utils/routerTo.js'
import FormateurDisplay from '../components/FormateurDisplay.jsx'
import DetailHeaderLogos from '../components/DetailHeaderLogos.jsx'
import { resolveSessionDetailCfaoLogo } from '../utils/resolveDetailCfaoLogo.js'
import { fmtDayLocale, localizedCatalogDuration, localizedCatalogPublic, localizedCatalogTrainingTitle, localizedCatalogType, localizedSessionTitle } from '../utils/localizeCard.js'
import { localizedFlagForSessionLieu, localizedSessionLieu } from '../utils/localizeGeo.js'

function MetaIcon({ children }) {
  return <span className="fiche-meta-pill-icon" aria-hidden="true">{children}</span>
}

function FormationFicheMeta({ session, day, mo, year }) {
  const { locale } = useLocale('fiche')
  const { t: ficheT } = useLocale('fiche')
  const { t: cardsT } = useLocale('cards')
  const isDist = session.lieu === 'Distanciel'
  const flag = localizedFlagForSessionLieu(session.lieu, locale)
  const lieuLabel = localizedSessionLieu(session.lieu, locale)
  const durationLabel = `${session.jours} ${session.jours > 1 ? cardsT.days : cardsT.day}`

  return (
    <ul className="formation-fiche-meta" aria-label={ficheT.metaAria}>
      <li>
        <span className="fiche-meta-pill fiche-meta-pill--code">
          <MetaIcon>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 0 1 0 2.828l-7 7a2 2 0 0 1-2.828 0l-7-7A2 2 0 0 1 3 12V7a4 4 0 0 1 4-4z" />
            </svg>
          </MetaIcon>
          {session.code}
        </span>
      </li>
      <li>
        <span className="fiche-meta-pill fiche-meta-pill--date">
          <MetaIcon>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </MetaIcon>
          {day} {mo} {year}
        </span>
      </li>
      <li>
        <span className="fiche-meta-pill fiche-meta-pill--duration">
          <MetaIcon>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          </MetaIcon>
          {durationLabel}
        </span>
      </li>
      <li>
        <span className={`fiche-meta-pill ${isDist ? 'fiche-meta-pill--distanciel' : 'fiche-meta-pill--presentiel'}`}>
          <MetaIcon>
            {isDist ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="4" width="20" height="14" rx="2" />
                <path d="M8 20h8M12 18v2" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 21s7-4.35 7-11a7 7 0 1 0-14 0c0 6.65 7 11 7 11z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
            )}
          </MetaIcon>
          {!isDist && flag && (
            <img
              src={flagCdnUrl(flag.code, 40)}
              srcSet={`${flagCdnUrl(flag.code, 80)} 2x`}
              alt=""
              className="fiche-meta-pill-flag"
              width={18}
              height={13}
            />
          )}
          {lieuLabel}
        </span>
      </li>
    </ul>
  )
}

function CatalogFicheMeta({ catalog }) {
  const { locale, t: ficheT } = useLocale('fiche')
  const typeLabel = localizedCatalogType(catalog.type, locale)
  const isDist = /distanciel|remote|distância|distance/i.test(typeLabel ?? '')

  return (
    <ul className="formation-fiche-meta" aria-label={ficheT.metaAria}>
      <li>
        <span className="fiche-meta-pill fiche-meta-pill--code">
          <MetaIcon>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 0 1 0 2.828l-7 7a2 2 0 0 1-2.828 0l-7-7A2 2 0 0 1 3 12V7a4 4 0 0 1 4-4z" />
            </svg>
          </MetaIcon>
          {catalog.code}
        </span>
      </li>
      {catalog.duration && (
        <li>
          <span className="fiche-meta-pill fiche-meta-pill--duration">
            <MetaIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            </MetaIcon>
            {localizedCatalogDuration(catalog.duration, locale)}
          </span>
        </li>
      )}
      {typeLabel && (
        <li>
          <span className={`fiche-meta-pill ${isDist ? 'fiche-meta-pill--distanciel' : 'fiche-meta-pill--presentiel'}`}>
            <MetaIcon>
              {isDist ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="4" width="20" height="14" rx="2" />
                  <path d="M8 20h8M12 18v2" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 21s7-4.35 7-11a7 7 0 1 0-14 0c0 6.65 7 11 7 11z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
              )}
            </MetaIcon>
            {typeLabel}
          </span>
        </li>
      )}
    </ul>
  )
}

function FormationFicheLead({ descriptor, formateur, formateurDisplay }) {
  const { locale, t: ficheT } = useLocale('fiche')
  const desc = descriptor
  const chips = []
  const display = formateurDisplay
    ?? (formateur ? { kind: 'single', name: formateur } : null)
  const publicLabel = desc.publicCible
    ? localizedCatalogPublic(desc.publicCible, locale)
    : null

  if (desc.kind === 'process' && publicLabel) {
    chips.push(
      <span key="public" className="formation-fiche-lead-chip">
        {ficheT.targetAudience} <strong>{publicLabel}</strong>
      </span>,
    )
  }
  if (desc.kind === 'technical') {
    if (desc.niveau) {
      chips.push(
        <span key="niveau" className="formation-fiche-lead-chip">
          {ficheT.level} <strong>{desc.niveau}</strong>
        </span>,
      )
    }
    if (publicLabel) {
      chips.push(
        <span key="public" className="formation-fiche-lead-chip">
          {ficheT.targetAudience} <strong>{publicLabel}</strong>
        </span>,
      )
    }
  }
  if (display) {
    chips.push(
      <span key="formateur" className="formation-fiche-lead-chip formation-fiche-lead-chip--formateur">
        <FormateurDisplay display={display} variant="fiche" />
      </span>,
    )
  }

  if (!chips.length) return null

  return <div className="formation-fiche-lead">{chips}</div>
}

function FicheHeaderLogos({ badgeSession }) {
  const { logo, label } = resolveSessionCardBadge(badgeSession)
  const cfaoLogo = resolveSessionDetailCfaoLogo(badgeSession)
  return (
    <DetailHeaderLogos cfaoLogo={cfaoLogo} brandLogo={logo} brandLabel={label} />
  )
}

export default function FormationFiche() {
  const { locale, t: ficheT } = useLocale('fiche')
  const { t: nfT } = useLocale('notFound')
  const location = useLocation()
  const navigate = useNavigate()
  const { code: codeParam } = useParams()
  const [searchParams] = useSearchParams()
  const session = searchParams.get('date')
    ? getSessionByCode(codeParam, searchParams.get('date'))
    : null
  const catalog = getCatalogFicheByCode(codeParam)
  const ficheUrl = session ? resolveFormationFicheUrl(session) : catalog?.url ?? null
  const closeTo = useMemo(
    () => sessionsHomeReturnLink(location, searchParams),
    [location, searchParams],
  )

  const handleBack = useCallback(() => {
    if (hasSessionsReturn(location, searchParams)) {
      const { to: path, state } = splitRouterTo(closeTo)
      navigate(path, { state })
      return
    }
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate('/')
  }, [closeTo, location, navigate, searchParams])

  if (!ficheUrl) {
    return (
      <SitePageLayout>
        <main className="article-page formation-fiche-page">
          <div className="container article-shell">
            <PageCloseButton onClick={handleBack} ariaLabel={ficheT.closeNotFound} fallbackTo="/" />
            <ContentNotFound
              eyebrow={nfT.eyebrow}
              title={ficheT.notFoundTitle}
              lead={ficheT.notFoundLead}
              primaryOnClick={handleBack}
              primaryLabel={nfT.back}
              primaryBack
            />
          </div>
        </main>
      </SitePageLayout>
    )
  }

  const title = session ? localizedSessionTitle(session, locale) : localizedCatalogTrainingTitle(catalog, locale)
  const badgeSession = session ?? { ...catalogFicheLogoContext(catalog), code: catalog.code }
  const descriptor = session
    ? getFormationFicheDescriptor(session)
    : getCatalogFicheDescriptor(catalog)
  const sessionDate = session ? fmtDayLocale(session.date, locale) : null
  const catalogFormateurDisplay = !session && catalog
    ? resolveCatalogFormateurDisplay({ folder: catalog.folder, training: catalog })
    : null
  const imageAlt = ficheT.sheetImageAlt
    .replace('{code}', session?.code ?? catalog.code)
    .replace('{title}', title)

  return (
    <SitePageLayout>
      <main className="article-page formation-fiche-page">
        <div className="container article-shell">
          <PageCloseButton onClick={handleBack} ariaLabel={ficheT.closeBack} fallbackTo="/" />

          <div className="article-main">
            <article className="article-sheet">
              <header className="article-header">
                <FicheHeaderLogos badgeSession={badgeSession} />
                <div className="news-tag news-tag--formation">{ficheT.sheetTag}</div>
                {session ? (
                  <FormationFicheMeta
                    session={session}
                    day={sessionDate.day}
                    mo={sessionDate.mo}
                    year={sessionDate.year}
                  />
                ) : (
                  <CatalogFicheMeta catalog={catalog} />
                )}
                <h1>{title}</h1>
                <FormationFicheLead
                  descriptor={descriptor}
                  formateur={session?.formateur?.trim() || null}
                  formateurDisplay={session ? null : catalogFormateurDisplay}
                />
              </header>

              <figure className="formation-fiche-figure">
                <img src={ficheUrl} alt={imageAlt} />
              </figure>
            </article>
          </div>
        </div>
      </main>
    </SitePageLayout>
  )
}
