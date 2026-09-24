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
import '../../styles/rh.css'

/** Visuel des cartes, par espace. */
const VISUEL = {
  recrutement: '/assets/img_cards/test_theorie_junior.jpg',
  competences: '/assets/img_cards/test_pratique_senior.jpg',
  pif: '/assets/img_cards/certification.jpg',
  personnes: '/assets/publics/techniciens.jpg',
}

const pct = v => (v == null ? '—' : `${v} %`)

/** Barre de couverture d'une cellule de tableau. */
function Couverture({ valeur }) {
  return (
    <div className="portal-inline-bar">
      <div className="portal-inline-track">
        <div className="portal-inline-fill"
          style={{ width: `${valeur ?? 0}%`, background: valeur >= 80 ? '#1aab5b' : undefined }} />
      </div>
      <span className="portal-inline-pct">{pct(valeur)}</span>
    </div>
  )
}

/** Titre de section, avec l'entree vers l'espace complet. */
function TeteSection({ surtitre, titre, espace, naviguer }) {
  return (
    <div className="portal-section-head rh-section-head">
      <div>
        <p className="portal-section-eyebrow">{surtitre}</p>
        <h2 className="portal-section-title">{titre}</h2>
      </div>
      <button type="button" className="rh-lien-espace"
        onClick={() => naviguer(`/portail/rh/${espace}`)}>
        Ouvrir l’espace →
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
      <main className="portal-page rh-portail">
        <div ref={headerRef}>
          <PortalHeader user={user} />
        </div>

        {/* ── Ce qui attend une action ─────────────────────────── */}
        <PortalReveal id="a-traiter" className="portal-next-actions-viewport cr-viewport">
          <div className="container" style={{ padding: '16px 32px' }}>
            <div className="portal-section-head rh-section-head">
              <div>
                <p className="portal-section-eyebrow">Priorité — ressources humaines</p>
                <h2 className="portal-section-title">À traiter</h2>
              </div>
              <div className="rh-perimetre" role="group" aria-label="Périmètre">
                {!filialeFixe && (
                  <select className="rh-perimetre-filiale" value={perimetre.filiale ?? ''}
                    aria-label="Filiale"
                    onChange={e => changer({ filiale: e.target.value || null })}>
                    <option value="">Toutes les filiales</option>
                    {filiales().map(f => (
                      <option key={f.code} value={f.code}>{f.pays}</option>
                    ))}
                  </select>
                )}
                <div className="rh-perimetre-bu" role="radiogroup" aria-label="BU">
                  {[null, ...BU].map(b => (
                    <button key={b ?? 'toutes'} type="button" role="radio"
                      aria-checked={perimetre.bu === b}
                      className={perimetre.bu === b ? 'actif' : ''}
                      onClick={() => changer({ bu: b })}>
                      {b ?? 'Toutes BU'}
                    </button>
                  ))}
                </div>
              </div>
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
              <p className="rh-vide">Rien en attente sur ce périmètre.</p>
            )}
          </div>
        </PortalReveal>

        {/* ── Recrutement : campagnes et exploitation ──────────── */}
        <PortalReveal id="recrutement">
          <div className="container" style={{ padding: '16px 32px' }}>
            <TeteSection surtitre="Campagnes et résultats" titre="Recrutement"
              espace="recrutement" naviguer={naviguer} />
            <div className="portal-kpi-row portal-kpi-row--compact">
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
            <div className="portal-kpi-row portal-kpi-row--compact">
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
              <div className="portal-table-wrap">
                <table className="portal-table rh-table">
                  <thead>
                    <tr>
                      <th>Filiale</th>
                      <th className="rh-num">Techniciens</th>
                      <th className="rh-num">Évalués</th>
                      <th>Couverture</th>
                      <th className="rh-num">Score moyen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {competences.parFiliale.map(f => (
                      <tr key={f.code} className="rh-ligne"
                        title={`Restreindre la page à ${f.pays}`}
                        onClick={() => changer({ filiale: f.code })}>
                        <td>{f.pays}</td>
                        <td className="rh-num">{f.techniciens}</td>
                        <td className="rh-num">{f.evalues}</td>
                        <td><Couverture valeur={f.couverture} /></td>
                        <td className="rh-num">{pct(f.moyenne)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </PortalReveal>

        {/* ── PIF : par filiale et par BU ──────────────────────── */}
        <PortalReveal id="pif">
          <div className="container" style={{ padding: '16px 32px' }}>
            <TeteSection surtitre="Plans individuels de formation" titre="PIF par filiale et BU"
              espace="pif" naviguer={naviguer} />
            <div className="portal-kpi-row portal-kpi-row--compact">
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
            {pif.parFiliale.length > 0 && (
              <div className="portal-table-wrap">
                <table className="portal-table rh-table">
                  <thead>
                    <tr>
                      <th>Filiale</th>
                      {buAffichees.map(b => <th key={b}>{b} — PIF / techniciens</th>)}
                      <th className="rh-num">Validés</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pif.parFiliale.map(f => (
                      <tr key={f.code}>
                        <td>{f.pays}</td>
                        {buAffichees.map(b => (
                          <td key={b}>
                            {f.parBU[b].techniciens
                              ? (
                                <div className="rh-cellule-pif">
                                  <span className="rh-num">{f.parBU[b].avecPif} / {f.parBU[b].techniciens}</span>
                                  <Couverture valeur={f.parBU[b].couverture} />
                                </div>
                              )
                              : <span className="rh-absent">—</span>}
                          </td>
                        ))}
                        <td className="rh-num">{f.valides}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </PortalReveal>

        {/* ── Personnes : candidats et techniciens ─────────────── */}
        <PortalReveal id="personnes">
          <div className="container" style={{ padding: '16px 32px' }}>
            <TeteSection surtitre="Candidats et techniciens" titre="Personnes"
              espace="personnes" naviguer={naviguer} />
            <div className="portal-kpi-row portal-kpi-row--compact">
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
