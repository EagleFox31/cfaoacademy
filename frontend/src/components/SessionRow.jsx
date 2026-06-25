import { Link } from 'react-router-dom'
import { fmtDay, BRANDS } from '../data/index.js'

const BRAND_LOGO = Object.fromEntries(
  BRANDS.filter(b => b.logo).map(b => [b.name.toUpperCase(), b.logo])
)
function getBrandLogo(marque) {
  if (!marque) return null
  return BRAND_LOGO[marque.toUpperCase()]
    ?? BRAND_LOGO[marque.split(' ')[0].toUpperCase()]
    ?? null
}

const LIEU_CODE = {
  'Cameroun':      'cm', 'Douala':    'cm', 'Yaoundé':  'cm',
  'Nigeria':       'ng',
  "Côte d'Ivoire": 'ci', 'RCI':       'ci', 'Abidjan':  'ci',
  'Togo':          'tg',
  'Sénégal':       'sn', 'Dakar':     'sn',
  'Bénin':         'bj',
  'Burkina Faso':  'bf',
  'Niger':         'ne',
  'Congo':         'cg',
  'Madagascar':    'mg',
  'Mali':          'ml',
  'Guinée':        'gn',
  'Gabon':         'ga',
  'Angola':        'ao',
  'Mozambique':    'mz',
  'Ghana':         'gh',
  'Rwanda':        'rw',
  'Kenya':         'ke',
  'Ouganda':       'ug',
  'Tanzanie':      'tz',
  'RGE':           'gq',
  'Guinée Éq.':    'gq',
}

export default function SessionRow({ session }) {
  const { day, mo, year } = fmtDay(session.date)
  const isDist = session.lieu === 'Distanciel'
  const logo = getBrandLogo(session.marque)
  const flagCode = isDist ? null : LIEU_CODE[session.lieu]

  return (
    <Link to="/sessions" className="session" style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="date">
        <div className="day">{day}</div>
        <div className="mo">{mo} · {year}</div>
      </div>

      <div className="title">
        <small>
          {session.code} <span className="bull">•</span>{' '}
          {logo
            ? <img src={logo} alt={session.marque} className="session-brand-logo" />
            : session.marque}
          {' '}<span className="bull">•</span> <span className="lvl-pill">{session.niveau}</span>
        </small>
        {session.nom}
        <div className="meta">
          Formateur <strong>{session.formateur}</strong> · {isDist ? 'places sur demande' : '12 places'}
        </div>
      </div>

      <span className={`tag ${session.tagClass}`}>{session.bu}</span>

      <div className="place">
        <div className="place-top">
          {isDist ? (
            <span className="mode-badge mode-online">En ligne</span>
          ) : (
            <span className="mode-badge mode-presentiel">Présentiel</span>
          )}
          <span className="dur">{session.jours} {session.jours > 1 ? 'jours' : 'jour'}</span>
        </div>
        <span className="place-lieu">
          {flagCode && (
            <img
              src={`https://flagcdn.com/w20/${flagCode}.png`}
              srcSet={`https://flagcdn.com/w40/${flagCode}.png 2x`}
              alt={session.lieu}
              className="session-flag"
              width="16" height="12"
            />
          )}
          {session.lieu}
        </span>
      </div>

      <span className="open" aria-label="Voir la session">↗</span>
    </Link>
  )
}
