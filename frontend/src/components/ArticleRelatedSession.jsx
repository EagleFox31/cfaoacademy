import { Link } from 'react-router-dom'
import { fmtDay } from '../data/index.js'
import { formationFicheRoute } from '../utils/formationFiche.js'
import { flagForSessionLieu, flagCdnUrl } from '../utils/sessionLieuFlag.js'
import useLocale from '../hooks/useLocale.js'
import { localizedSessionLieu } from '../utils/localizeGeo.js'

export default function ArticleRelatedSession({ session }) {
  const { locale, t: cardsT } = useLocale('cards')
  if (!session) return null

  const { day, mo, year } = fmtDay(session.date)
  const isDist = session.lieu === 'Distanciel'
  const flag = flagForSessionLieu(session.lieu)
  const lieuLabel = localizedSessionLieu(session.lieu, locale)
  const durationLabel = `${session.jours} ${session.jours > 1 ? cardsT.days : cardsT.day}`

  return (
    <div className="article-session-card">
      <p className="article-toc-heading">Session liée</p>
      <Link to={formationFicheRoute(session)} className="article-session-card-link">
        <div className="article-session-date">
          <span className="article-session-day">{day}</span>
          <span className="article-session-mo">
            {mo} · {year}
          </span>
        </div>
        <p className="article-session-kicker">
          {session.code} · {session.marque} · <span>{session.niveau}</span>
        </p>
        <p className="article-session-title">{session.nom}</p>
        <p className="article-session-meta">
          {!isDist && flag && (
            <img
              src={flagCdnUrl(flag.code)}
              srcSet={`${flagCdnUrl(flag.code, 80)} 2x`}
              alt=""
              className="article-session-flag"
              width={22}
              height={16}
            />
          )}
          <span>
            {lieuLabel}
            {' · '}
            {durationLabel}
          </span>
        </p>
        <span className={`tag ${session.tagClass} article-session-tag`}>{session.bu}</span>
        <span className="article-session-cta">Voir la fiche de la formation →</span>
      </Link>
    </div>
  )
}
