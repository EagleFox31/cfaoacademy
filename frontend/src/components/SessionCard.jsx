import { useEffect, useState } from 'react'
import PvCard from './PvCard.jsx'
import { resolveSessionCardBadge } from '../utils/cardBrandBadge.js'
import {
  resolveFormationFicheUrl,
} from '../utils/formationFiche.js'
import {
  buildFormationFicheTo,
  persistSessionsReturn,
} from '../utils/sessionsReturn.js'
import { flagCdnUrl } from '../utils/sessionLieuFlag.js'
import FormateurBadge from './FormateurBadge.jsx'
import useLocale from '../hooks/useLocale.js'
import { fmtDayLocale, localizedSessionTitle } from '../utils/localizeCard.js'
import { localizedSessionLieu, localizedFlagForSessionLieu } from '../utils/localizeGeo.js'

const SESSION_IMG = {
  motors: '/assets/publics/techniciens.jpg',
  equipment: '/assets/publics/techniciens.jpg',
  carrosserie: '/assets/publics/carrossiers.jpg',
  'parts-motors': '/assets/publics/parts.jpg',
  'parts-eq': '/assets/publics/parts.jpg',
}

function SessionCardMedia({ src, fallback, statusChip }) {
  const [resolved, setResolved] = useState(src)
  useEffect(() => { setResolved(src) }, [src])

  return (
    <div className="pv-card-img portal-session-card-img">
      <img
        src={resolved}
        alt=""
        loading="lazy"
        onError={() => {
          if (fallback && resolved !== fallback) setResolved(fallback)
        }}
      />
      {statusChip && (
        <div className="portal-eval-img-tags">{statusChip}</div>
      )}
    </div>
  )
}

export default function SessionCard({
  session,
  sessionsReturn,
  onClick,
  kickerPrefix,
  statusOnImage = false,
  showSessionDate = true,
  accentColor,
  cta,
  hoverHint,
}) {
  const { locale } = useLocale('cards')
  const { t: cardsT } = useLocale('cards')
  const hasDate = Boolean(session.date)
  const { day, mo, year } = hasDate ? fmtDayLocale(session.date, locale) : {}
  const { logo, label } = resolveSessionCardBadge(session)
  const isDist = session.lieu === 'Distanciel'
  const mode = isDist ? cardsT.remote : cardsT.onsite
  const flag = localizedFlagForSessionLieu(session.lieu, locale)
  const lieuLabel = localizedSessionLieu(session.lieu, locale)
  const formateur = session.formateur?.trim()
  const ficheImg = resolveFormationFicheUrl(session)
  const returnCtx = sessionsReturn?.tab || sessionsReturn?.sectionId
    ? {
        ...sessionsReturn,
        sectionId: sessionsReturn.sectionId ?? (sessionsReturn.tab ? 'sessions' : null),
      }
    : null
  const ficheTo = returnCtx
    ? buildFormationFicheTo(session, returnCtx)
    : buildFormationFicheTo(session)
  const dayLabel = session.jours > 1 ? cardsT.days : cardsT.day

  const captureReturn = () => {
    if (!returnCtx) return
    persistSessionsReturn({
      ...returnCtx,
      scrollY: window.scrollY,
    })
  }

  const datePart = showSessionDate && hasDate ? `${day} ${mo} ${year}` : ''
  const dateKicker = [datePart, session.niveau].filter(Boolean).join(' · ') || null
  const imageStatusChip = statusOnImage && kickerPrefix ? kickerPrefix : null
  const kickerStatusChip = !statusOnImage && kickerPrefix ? kickerPrefix : null
  const fallbackImg = SESSION_IMG[session.tagClass] ?? '/assets/publics/techniciens.jpg'
  const cardImg = ficheImg ?? fallbackImg

  return (
    <PvCard
      to={onClick ? undefined : ficheTo}
      onClick={onClick}
      onBeforeNavigate={!onClick && (sessionsReturn?.tab || sessionsReturn?.sectionId) ? captureReturn : undefined}
      variant={ficheImg ? 'doc' : undefined}
      corner
      logo={logo}
      brandLabel={label}
      cardMedia={imageStatusChip ? (
        <SessionCardMedia src={cardImg} fallback={fallbackImg} statusChip={imageStatusChip} />
      ) : undefined}
      img={imageStatusChip ? undefined : cardImg}
      kicker={kickerStatusChip
        ? (
          <span className="pv-card-kicker-row">
            {kickerStatusChip}
            {dateKicker && <span>{dateKicker}</span>}
          </span>
        )
        : dateKicker}
      title={localizedSessionTitle(session, locale)}
      meta={(
        <div className="pv-card-meta--session">
          <span className="pv-card-meta-lieu">
            {!isDist && flag && (
              <img
                src={flagCdnUrl(flag.code, 40)}
                srcSet={`${flagCdnUrl(flag.code, 80)} 2x`}
                alt=""
                className="pv-card-session-flag"
                width={20}
                height={15}
              />
            )}
            <span>{lieuLabel}</span>
            {session.jours > 0 && (
              <>
                <span className="pv-card-meta-sep" aria-hidden="true">·</span>
                <span>{session.jours} {dayLabel}</span>
              </>
            )}
            <span className="pv-card-meta-sep" aria-hidden="true">·</span>
            <span>{mode}</span>
          </span>
          {formateur && (
            <FormateurBadge name={formateur} variant="card" className="pv-card-meta-formateur" />
          )}
        </div>
      )}
      cta={cta ?? cardsT.sessionFiche}
      hoverHint={hoverHint ?? cardsT.sessionFicheHint}
      accentColor={accentColor}
    />
  )
}
