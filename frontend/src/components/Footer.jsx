import { Link } from 'react-router-dom'
import useLocale from '../hooks/useLocale.js'

const NAV_COLS = [
  {
    titleKey: 'colNav',
    links: [
      { key: 'linkAbout', to: '/a-propos' },
      { key: 'linkFormations', to: '/formations' },
      { key: 'linkPublics', to: '/publics' },
      { key: 'linkNews', to: '/actualites' },
    ],
  },
  {
    titleKey: 'colAccess',
    links: [
      { key: 'linkContact', to: '/contact' },
      { key: 'linkLogin', to: '/login' },
    ],
  },
]

const STATS = [
  { value: '35+', key: 'statCountries' },
  { value: '17', key: 'statBrands' },
  { value: '120+', key: 'statCourses' },
]

export default function Footer() {
  const { t } = useLocale('footer')

  return (
    <footer className="footer">
      {/* Accent top */}
      <div className="footer-accent" aria-hidden="true" />

      <div className="container">

        {/* ── Grille principale ── */}
        <div className="footer-grid">

          {/* Colonne brand */}
          <div className="footer-brand-col">
            <Link to="/" className="footer-brand-link">
              <img src="/assets/logo-cfao-mobility.jpg" alt="CFAO Mobility" className="footer-logo" />
              <span className="footer-brand-name">academy<span className="footer-brand-dot">.</span></span>
            </Link>

            <p className="footer-tagline">{t.tagline}</p>

            <div className="footer-stats">
              {STATS.map(({ value, key }) => (
                <div key={key} className="footer-stat">
                  <span className="footer-stat-num">{value}</span>
                  <span className="footer-stat-lbl">{t[key]}</span>
                </div>
              ))}
            </div>

            <a href={`mailto:${t.email}`} className="footer-email">
              {t.email}
            </a>
          </div>

          {/* Colonnes de navigation */}
          {NAV_COLS.map((col) => (
            <div key={col.titleKey} className="footer-col">
              <h6 className="footer-col-title">{t[col.titleKey]}</h6>
              <ul className="footer-col-list">
                {col.links.map(({ key, to }) => (
                  <li key={key}>
                    <Link to={to} className="footer-col-link">
                      {t[key]}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

        </div>

        {/* ── Barre du bas ── */}
        <div className="footer-bottom">
          <span className="footer-copyright">
            {t.copyright} — {t.entity}
          </span>

          <div className="footer-legal">
            <Link to="/mentions-legales" className="footer-legal-link">{t.legal}</Link>
            <span className="footer-legal-sep" aria-hidden="true" />
            <Link to="/confidentialite" className="footer-legal-link">{t.privacy}</Link>
          </div>

          <span className="footer-location">{t.location}</span>
        </div>

      </div>

      {/* Watermark décoratif */}
      <div className="footer-watermark" aria-hidden="true">ACADEMY</div>
    </footer>
  )
}
