import { Navigate, useLocation, useSearchParams } from 'react-router-dom'
import SitePageLayout from '../components/SitePageLayout.jsx'
import PageCloseButton from '../components/PageCloseButton.jsx'
import ProfileAvatar from '../components/ProfileAvatar.jsx'
import { AccountBadges, useAccountSummary } from '../components/UserMenu.jsx'
import LocaleSwitch from '../components/LocaleSwitch.jsx'
import { GlobeIcon, LockIcon, UserIcon } from '../components/portalSectionIcons.jsx'
import useAuth from '../hooks/useAuth.js'
import useLocale from '../hooks/useLocale.js'
import useMaFicheFormateur from '../hooks/useMaFicheFormateur.js'
import { resolveBrandLogo } from '../components/PortalBrandLogo.jsx'
import { OIDC_ACTIF, changePassword } from '../lib/auth.js'

/** Marques du formateur : logo + nom, l'un à côté de l'autre. */
function MesMarques({ marques }) {
  if (!marques.length) return null
  return (
    <ul className="profile-brands">
      {marques.map(m => {
        const logo = resolveBrandLogo(m.code)
        return (
          <li key={m.code} className="profile-brand">
            {logo ? <img src={logo} alt="" className="profile-brand-logo" loading="lazy" decoding="async" /> : null}
            <span>{m.label}</span>
          </li>
        )
      })}
    </ul>
  )
}

/** Une ligne de rubrique : libellé à gauche, valeur (ou réglage) à droite. */
function Row({ label, children }) {
  return (
    <div className="profile-row">
      <dt className="profile-row-label">{label}</dt>
      <dd className="profile-row-value">{children}</dd>
    </div>
  )
}

/**
 * Page « Mon profil », ouverte depuis le menu du compte. Comme les pages compte
 * de Google ou d'Apple : les rubriques à gauche (onglets), le contenu en lignes
 * à droite. Une rubrique s'ajoute dans `rubriques` ; celle ouverte est dans
 * l'adresse (`?rubrique=`).
 */
export default function Profil() {
  const { user } = useAuth()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const { t, locale, setLocale } = useLocale('profile')
  const fiche = useMaFicheFormateur(user)
  const account = useAccountSummary(user, fiche?.pays)
  const returnTo = location.state?.from || '/portail'

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />

  // Formateur : pays et marques viennent de sa fiche du planning.
  const ficheEnCours = fiche?.etat === 'loading'
  const enAttente = valeur => (ficheEnCours ? t.loading : valeur)

  const rubriques = [
    {
      id: 'compte',
      icon: UserIcon,
      label: t.account_title,
      rows: [
        { label: t.card_role, value: account.roleLabel },
        { label: t.card_country, value: fiche ? enAttente(account.paysLabel) : account.paysLabel },
        fiche && { label: t.card_brands, value: enAttente(<MesMarques marques={fiche.marques} />), vide: !ficheEnCours && !fiche.marques.length },
        { label: t.card_email, value: account.email },
        { label: t.card_login, value: user.username || user.compte },
      ].filter(Boolean),
    },
    {
      id: 'langue',
      icon: GlobeIcon,
      label: t.card_language,
      rows: [{
        label: t.language_label,
        value: (
          <LocaleSwitch
            locale={locale}
            onChange={setLocale}
            ariaLabel={t.language_aria}
            className="profile-locale-switch"
            withLabels
          />
        ),
      }],
    },
    // Comptes Keycloak seulement : les profils de démonstration n'ont pas de mot de passe.
    OIDC_ACTIF && {
      id: 'securite',
      icon: LockIcon,
      label: t.security_title,
      rows: [{
        label: t.card_password,
        value: (
          <button
            type="button"
            className="profile-action"
            onClick={() => changePassword(`${location.pathname}?rubrique=securite`)}
          >
            {t.password_cta}
          </button>
        ),
      }],
    },
  ].filter(Boolean)

  const active = rubriques.find(r => r.id === params.get('rubrique')) ?? rubriques[0]
  const ouvrir = id => setParams(id === rubriques[0].id ? {} : { rubrique: id }, { replace: true, state: location.state })

  return (
    <SitePageLayout>
      <main className="article-page profile-page">
        <div className="container article-shell">
          <div className="article-main">
            <article className="article-sheet profile-sheet">
              <PageCloseButton to={returnTo} ariaLabel={t.page_close} className="profile-close" />
              <header className="profile-head">
                <ProfileAvatar
                  person={user}
                  name={account.fullName}
                  className="profile-avatar"
                  imgClassName="nav-user-avatar-img"
                />
                <div className="profile-head-text">
                  <h1>{account.fullName}</h1>
                  <div className="nav-user-dropdown-meta profile-page-badges">
                    <AccountBadges summary={account} />
                  </div>
                </div>
              </header>

              <div className="profile-body">
                <nav className="profile-tabs" role="tablist" aria-label={t.menu_aria}>
                  {rubriques.map(r => {
                    const Icon = r.icon
                    const selected = r.id === active.id
                    return (
                      <button
                        key={r.id}
                        type="button"
                        role="tab"
                        id={`profil-tab-${r.id}`}
                        aria-selected={selected}
                        aria-controls={`profil-panel-${r.id}`}
                        className={`profile-tab${selected ? ' is-active' : ''}`}
                        onClick={() => ouvrir(r.id)}
                      >
                        <Icon size={18} />
                        <span>{r.label}</span>
                      </button>
                    )
                  })}
                </nav>

                <section
                  className="profile-panel"
                  role="tabpanel"
                  id={`profil-panel-${active.id}`}
                  aria-labelledby={`profil-tab-${active.id}`}
                >
                  <h2 className="profile-panel-title">{active.label}</h2>
                  <dl className="profile-list">
                    {active.rows.map(row => (
                      <Row key={row.label} label={row.label}>{(!row.vide && row.value) || t.not_set}</Row>
                    ))}
                  </dl>
                </section>
              </div>
            </article>
          </div>
        </div>
      </main>
    </SitePageLayout>
  )
}
