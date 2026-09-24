import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Nav from '../../components/Nav'
import Footer from '../../components/Footer'
import PortalHeader from '../../components/PortalHeader'
import PortalStickyBar from '../../components/PortalStickyBar'
import PortalDemoBar from '../../components/PortalDemoBar'
import PortalReveal from '../../components/PortalReveal.jsx'
import PortalStaggerGrid from '../../components/PortalStaggerGrid.jsx'
import PortalAssistanceSection from '../../components/PortalAssistanceSection.jsx'
import PvCard from '../../components/PvCard'
import useSiteEffects from '../../hooks/useSiteEffects'
import useAuth from '../../hooks/useAuth'
import useLocale from '../../hooks/useLocale'
import usePortalBackground from '../../hooks/usePortalBackground'
import usePortalHeaderHeight from '../../hooks/usePortalHeaderHeight.js'
import {
  BU, PERIMETRE_GROUPE, filiales, nomFiliale, priorites,
  syntheseRecrutement, syntheseCompetences, synthesePIF, synthesePersonnes,
} from '../../utils/rhDonnees'

/** Visuel des cartes, par espace. */
const VISUEL = {
  recrutement: '/assets/img_cards/test_theorie_junior.jpg',
  competences: '/assets/img_cards/test_pratique_senior.jpg',
  pif: '/assets/img_cards/certification.jpg',
  personnes: '/assets/publics/techniciens.jpg',
}

const pct = v => (v == null ? '—' : `${v} %`)

const ETAT = [
  [80, 'done', 'Couverte'],
  [50, 'progress', 'En cours'],
  [0, 'todo', 'En retard'],
]
/** Puce de statut d'une couverture, comme celles des cartes du portail. */
function puce(couverture) {
  const [, cls, libelle] = ETAT.find(([seuil]) => (couverture ?? 0) >= seuil)
  return <span className={`portal-status-chip ${cls}`}>{libelle}</span>
}

/** Carte d'un pays : la carte du portail, drapeau en visuel — cadre
 * comme le logo des cartes marque (fond blanc, image contenue). */
function CartePays({ f, kicker, meta, onClick }) {
  return (
    <div className="portal-card-anchor">
      <PvCard
        cardMedia={(
          <div className="pv-card-img" style={{ padding: 24, background: 'white' }}>
            <img src={`https://flagcdn.com/w320/${f.code}.png`} alt={f.pays} loading="lazy"
              style={{ objectFit: 'contain', width: '100%', height: '100%' }} />
          </div>
        )}
        kicker={kicker}
        title={f.pays}
        meta={meta}
        cta="Voir le pays"
        hoverHint={`Restreindre la page à ${f.pays}`}
        onClick={onClick}
        corner
      />
    </div>
  )
}

/** Titre de section, avec l'entree vers l'espace complet — meme motif que
 * « Voir plus » des prochaines actions apprenant. */
function TeteSection({ surtitre, titre, espace, naviguer }) {
  return (
    <div className="portal-section-head portal-section-head--with-action">
      <div>
        <p className="portal-section-eyebrow">{surtitre}</p>
        <h2 className="portal-section-title">{titre}</h2>
      </div>
      <button type="button" className="portal-next-actions-more"
        onClick={() => naviguer(`/portail/rh/${espace}`)}>
        Ouvrir l’espace
        <span className="portal-next-actions-more-arrow" aria-hidden="true">→</span>
      </button>
    </div>
  )
}

/**
 * Accueil RH — vue groupe.
 *
 * Meme rythme que les autres portails : entete, ce qui attend une action,
 * puis une section par espace, dans l'ordre du cycle RH — recruter,
 * mesurer, former, gerer les personnes. Chaque section resume son espace
 * et y mene ; les espaces eux-memes viendront ensuite.
 *
 * Le perimetre (filiale, BU) s'applique a toute la page. La RH groupe le
 * choisit ; la RH filiale aura sa filiale fixee (`filialeFixe`).
 */
export default function RHHome({ filialeFixe = null }) {
  useSiteEffects()
  const { user } = useAuth()
  const { t } = useLocale('portal')
  const naviguer = useNavigate()
  const headerRef = useRef(null)
  usePortalBackground(user)
  usePortalHeaderHeight(headerRef)

  const [perimetre, setPerimetre] = useState({ ...PERIMETRE_GROUPE, filiale: filialeFixe })
  const changer = patch => setPerimetre(p => ({ ...p, ...patch }))

  const aTraiter = useMemo(() => priorites(perimetre), [perimetre])
  const recrutement = useMemo(() => syntheseRecrutement(perimetre), [perimetre])
  const competences = useMemo(() => syntheseCompetences(perimetre), [perimetre])
  const pif = useMemo(() => synthesePIF(perimetre), [perimetre])
  const personnes = useMemo(() => synthesePersonnes(perimetre), [perimetre])

  if (!user) return null

  const vueGroupe = !perimetre.filiale
  const buAffichees = perimetre.bu ? [perimetre.bu] : BU

  return (
    <>
      <Nav />
      <PortalStickyBar user={user} headerRef={headerRef} />
      <main className="portal-page">
        <div ref={headerRef}>
          <PortalHeader user={user} />
        </div>

        {/* ── Ce qui attend une action ─────────────────────────── */}
        <PortalReveal id="a-traiter" className="portal-next-actions-viewport cr-viewport">
          <div className="container" style={{ padding: '16px 32px' }}>
            <div className="portal-section-head">
              <p className="portal-section-eyebrow">Priorité — ressources humaines</p>
              <h2 className="portal-section-title">À traiter</h2>
            </div>
            <div className="portal-plan-filters portal-plan-filters--compact" role="group" aria-label="Périmètre">
              {!filialeFixe && (
                <label className="portal-plan-filter-field">
                  <span>Filiale</span>
                  <select value={perimetre.filiale ?? ''}
                    onChange={e => changer({ filiale: e.target.value || null })}>
                    <option value="">Toutes les filiales</option>
                    {filiales().map(f => <option key={f.code} value={f.code}>{f.pays}</option>)}
                  </select>
                </label>
              )}
              <label className="portal-plan-filter-field">
                <span>BU</span>
                <select value={perimetre.bu ?? ''} onChange={e => changer({ bu: e.target.value || null })}>
                  <option value="">Toutes les BU</option>
                  {BU.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>
            </div>

            {aTraiter.length > 0 ? (
              <PortalStaggerGrid>
                {aTraiter.map(a => (
                  <div key={`${a.nature}-${a.titre}`} className="portal-card-anchor">
                    <PvCard
                      img={VISUEL[a.espace]}
                      kicker={<span className="portal-status-chip progress">{a.nature}</span>}
                      title={a.titre}
                      meta={a.detail}
                      cta="Traiter"
                      accentColor="#E3001B"
                      hoverHint="Ouvrir l’espace concerné"
                      onClick={() => naviguer(`/portail/rh/${a.espace}`)}
                      corner
                    />
                  </div>
                ))}
              </PortalStaggerGrid>
            ) : (
              <p className="portal-plan-filter-empty">Rien en attente sur ce périmètre.</p>
            )}
          </div>
        </PortalReveal>

        {/* ── Recrutement : campagnes et exploitation ──────────── */}
        <PortalReveal id="recrutement">
          <div className="container" style={{ padding: '16px 32px' }}>
            <TeteSection surtitre="Campagnes et résultats" titre="Recrutement"
              espace="recrutement" naviguer={naviguer} />
            <div className="portal-kpi-row">
              <div className="portal-kpi-card">
                <div className="portal-kpi-value accent">{recrutement.ouvertes}</div>
                <div className="portal-kpi-label">Campagne{recrutement.ouvertes > 1 ? 's' : ''} ouverte{recrutement.ouvertes > 1 ? 's' : ''}</div>
              </div>
              <div className="portal-kpi-card">
                <div className="portal-kpi-value">{recrutement.candidats}</div>
                <div className="portal-kpi-label">Candidats</div>
              </div>
              <div className="portal-kpi-card">
                <div className="portal-kpi-value green">{recrutement.testes}</div>
                <div className="portal-kpi-label">Candidats testés</div>
              </div>
              <div className="portal-kpi-card">
                <div className="portal-kpi-value">{recrutement.campagnes.length}</div>
                <div className="portal-kpi-label">Campagnes au total</div>
              </div>
            </div>
            <PortalStaggerGrid>
              {recrutement.campagnes.slice(0, 3).map(c => (
                <div key={c.id} className="portal-card-anchor">
                  <PvCard
                    img={VISUEL.recrutement}
                    kicker={c.statut === 'ouverte'
                      ? <span className="portal-status-chip progress">Ouverte</span>
                      : <span className="portal-status-chip done">Clôturée</span>}
                    title={c.intitule}
                    meta={`${nomFiliale(c.f)} · ${c.bu.join(' · ')} · ${c.testes}/${c.candidats} testés${
                      c.moyenne != null ? ` · moyenne ${c.moyenne} %` : ''}`}
                    cta={c.statut === 'ouverte' ? 'Suivre la campagne' : 'Exploiter les résultats'}
                    hoverHint="Ouvrir la campagne"
                    onClick={() => naviguer('/portail/rh/recrutement')}
                    corner
                  />
                </div>
              ))}
              <div className="portal-card-anchor">
                <PvCard
                  img={VISUEL.personnes}
                  kicker={<span className="portal-status-chip todo">Préparer</span>}
                  title="Nouvelle campagne de recrutement"
                  meta="Poste, filiale, BU, dates — et import des candidats depuis Excel."
                  cta="Créer"
                  accentColor="#E3001B"
                  hoverHint="Créer une campagne"
                  onClick={() => naviguer('/portail/rh/recrutement')}
                  corner
                />
              </div>
            </PortalStaggerGrid>
          </div>
        </PortalReveal>

        {/* ── Compétences : mesure et exploitation ─────────────── */}
        <PortalReveal id="competences">
          <div className="container" style={{ padding: '16px 32px' }}>
            <TeteSection surtitre={competences.campagne?.intitule ?? 'Mesure des compétences'}
              titre="Compétences" espace="competences" naviguer={naviguer} />
            <div className="portal-kpi-row">
              <div className="portal-kpi-card">
                <div className="portal-kpi-value">{competences.techniciens}</div>
                <div className="portal-kpi-label">Techniciens</div>
              </div>
              <div className="portal-kpi-card">
                <div className="portal-kpi-value green">{competences.evalues}</div>
                <div className="portal-kpi-label">Évalués</div>
              </div>
              <div className="portal-kpi-card">
                <div className="portal-kpi-value accent">{pct(competences.couverture)}</div>
                <div className="portal-kpi-label">Couverture</div>
              </div>
              <div className="portal-kpi-card">
                <div className="portal-kpi-value">{pct(competences.moyenne)}</div>
                <div className="portal-kpi-label">Score moyen</div>
              </div>
            </div>
            {vueGroupe && competences.parFiliale.length > 0 && (
              <PortalStaggerGrid>
                {competences.parFiliale.map(f => (
                  <CartePays key={f.code} f={f}
                    kicker={puce(f.couverture)}
                    meta={`${f.evalues}/${f.techniciens} techniciens évalués · ${f.couverture ?? 0} %${
                      f.moyenne != null ? ` · moyenne ${f.moyenne} %` : ''}`}
                    onClick={() => changer({ filiale: f.code })} />
                ))}
              </PortalStaggerGrid>
            )}
          </div>
        </PortalReveal>

        {/* ── PIF : par filiale et par BU ──────────────────────── */}
        <PortalReveal id="pif">
          <div className="container" style={{ padding: '16px 32px' }}>
            <TeteSection surtitre="Plans individuels de formation" titre="PIF par filiale et BU"
              espace="pif" naviguer={naviguer} />
            <div className="portal-kpi-row">
              <div className="portal-kpi-card">
                <div className="portal-kpi-value">{pif.evalues}</div>
                <div className="portal-kpi-label">Techniciens évalués</div>
              </div>
              <div className="portal-kpi-card">
                <div className="portal-kpi-value">{pif.avecPif}</div>
                <div className="portal-kpi-label">Avec un PIF</div>
              </div>
              <div className="portal-kpi-card">
                <div className="portal-kpi-value green">{pif.valides}</div>
                <div className="portal-kpi-label">PIF validés</div>
              </div>
              <div className="portal-kpi-card">
                <div className="portal-kpi-value accent">{pct(pif.couverture)}</div>
                <div className="portal-kpi-label">Couverture</div>
              </div>
            </div>
            {vueGroupe && pif.parFiliale.length > 0 && (
              <PortalStaggerGrid>
                {pif.parFiliale.map(f => (
                  <CartePays key={f.code} f={f}
                    kicker={puce(f.couverture)}
                    meta={`${buAffichees.filter(b => f.parBU[b].techniciens)
                      .map(b => `${b} ${f.parBU[b].avecPif}/${f.parBU[b].techniciens}`).join(' · ')} · ${
                      f.valides} validé${f.valides > 1 ? 's' : ''}`}
                    onClick={() => changer({ filiale: f.code })} />
                ))}
              </PortalStaggerGrid>
            )}
          </div>
        </PortalReveal>

        {/* ── Personnes : candidats et techniciens ─────────────── */}
        <PortalReveal id="personnes">
          <div className="container" style={{ padding: '16px 32px' }}>
            <TeteSection surtitre="Candidats et techniciens" titre="Personnes"
              espace="personnes" naviguer={naviguer} />
            <div className="portal-kpi-row">
              <div className="portal-kpi-card">
                <div className="portal-kpi-value">{personnes.techniciens}</div>
                <div className="portal-kpi-label">Techniciens actifs</div>
              </div>
              <div className="portal-kpi-card">
                <div className="portal-kpi-value">{personnes.candidats}</div>
                <div className="portal-kpi-label">Candidats</div>
              </div>
              <div className="portal-kpi-card">
                <div className="portal-kpi-value">{personnes.supprimes}</div>
                <div className="portal-kpi-label">Dans la corbeille</div>
              </div>
              <div className="portal-kpi-card">
                <div className={`portal-kpi-value ${personnes.aCompleter ? 'accent' : 'green'}`}>
                  {personnes.aCompleter}
                </div>
                <div className="portal-kpi-label">Fiches à compléter</div>
              </div>
            </div>
          </div>
        </PortalReveal>

        <PortalAssistanceSection t={t} variant="learner" />
      </main>

      <Footer />
      <PortalDemoBar />
    </>
  )
}
