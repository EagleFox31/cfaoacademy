import { useMemo, useRef, useState } from 'react'
import Nav from '../../components/Nav'
import Footer from '../../components/Footer'
import PortalHeader from '../../components/PortalHeader'
import PortalStickyBar from '../../components/PortalStickyBar'
import PortalDemoBar from '../../components/PortalDemoBar'
import PortalReveal from '../../components/PortalReveal.jsx'
import PortalStaggerGrid from '../../components/PortalStaggerGrid.jsx'
import PvCard from '../../components/PvCard'
import useSiteEffects from '../../hooks/useSiteEffects'
import useAuth from '../../hooks/useAuth'
import usePortalBackground from '../../hooks/usePortalBackground'
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


/** Seuils et couleurs des statuts : puces du portail (`portal-status-chip`
 * done / progress / todo) et couleurs de docs/PORTAL_COLORIMETRY.md
 * (vert fait, orange en cours, rouge non fait). */
const ETAT = [
  [80, 'done', 'Couverte', '#1aab5b'],
  [50, 'progress', 'En cours', '#e67e00'],
  [0, 'todo', 'En retard', 'var(--red)'],
]
const etat = valeur => ETAT.find(([seuil]) => (valeur ?? 0) >= seuil)

/** Le drapeau en entete de carte, traite comme les heros du portail :
 * voile marine en degrade (fonce a gauche, plus leger a droite), statut
 * et nom du pays en blanc par-dessus. Le drapeau reste lisible sans dominer. */
function VisuelPays({ f }) {
  const [, cls, libelle] = etat(f.couverture)
  return (
    <div className="pv-card-img" style={{ position: 'relative', height: 112, background: '#0e1126' }}>
      <img src={`https://flagcdn.com/w640/${f.code}.png`}
        srcSet={`https://flagcdn.com/w1280/${f.code}.png 2x`} alt="" loading="lazy"
        style={{ filter: 'saturate(0.9)' }} />
      <span aria-hidden="true" style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(105deg, rgba(14,17,38,0.72) 0%, rgba(14,17,38,0.42) 50%, rgba(14,17,38,0.12) 100%)',
      }} />
      <span className={`portal-status-chip ${cls}`} style={{ position: 'absolute', top: 14, left: 20 }}>{libelle}</span>
      <div style={{ position: 'absolute', left: 20, right: 60, bottom: 14, color: '#fff', pointerEvents: 'none' }}>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{f.pays}</div>
      </div>
    </div>
  )
}

/** Barre de progression du portail, a la couleur du statut. Les couleurs
 * sont fixees : la carte reste claire, meme dans une section sombre. */
function Progression({ libelle, valeur, droite, attente }) {
  const couleur = attente ? 'var(--muted)' : etat(valeur)[3]
  return (
    <div className="portal-progress-block">
      <div className="portal-progress-head" style={{ marginBottom: 6 }}>
        <span className="portal-progress-lbl" style={{ color: 'var(--navy)', fontSize: 13 }}>{libelle}</span>
        {droite && <span className="portal-progress-pct" style={{ color: couleur, fontSize: 13 }}>{droite}</span>}
      </div>
      <div className="portal-progress-track" style={{ background: 'var(--rule)' }}>
        <div className="portal-progress-fill" style={{ width: `${attente ? 0 : valeur ?? 0}%`, background: couleur }} />
      </div>
    </div>
  )
}

/** Carte d'un pays — carte du portail : entete drapeau facon heros, chiffre
 * cle en titre, une barre de progression. */
function CartePays({ f, titre, meta }) {
  return (
    <div className="portal-card-anchor">
      <PvCard
        cardMedia={<VisuelPays f={f} />}
        title={titre}
        meta={meta}
        cta="Voir le pays"
        hoverHint={`Détail de ${f.pays}`}
        corner
      />
    </div>
  )
}

/** Titre de section du portail. */
function TeteSection({ surtitre, titre }) {
  return (
    <div className="portal-section-head">
      <p className="portal-section-eyebrow">{surtitre}</p>
      <h2 className="portal-section-title">{titre}</h2>
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
  const headerRef = useRef(null)
  usePortalBackground(user)

  const [perimetre, setPerimetre] = useState({ ...PERIMETRE_GROUPE, filiale: filialeFixe })
  const changer = patch => setPerimetre(p => ({ ...p, ...patch }))

  const aTraiter = useMemo(() => priorites(perimetre), [perimetre])
  const recrutement = useMemo(() => syntheseRecrutement(perimetre), [perimetre])
  // Les chiffres des cartes Recrutement : ouvertes d'un cote, cloturees de l'autre.
  const { enCours, terminees } = useMemo(() => {
    const somme = (liste, cle) => liste.reduce((n, c) => n + c[cle], 0)
    const ouvertes = recrutement.campagnes.filter(c => c.statut === 'ouverte')
    const closes = recrutement.campagnes.filter(c => c.statut !== 'ouverte')
    const notees = closes.filter(c => c.moyenne != null && c.testes)
    const prochaine = ouvertes.map(c => c.fin).filter(Boolean).sort()[0]
    return {
      enCours: {
        nombre: ouvertes.length,
        candidats: somme(ouvertes, 'candidats'),
        testes: somme(ouvertes, 'testes'),
        avancement: Math.round(100 * somme(ouvertes, 'testes') / (somme(ouvertes, 'candidats') || 1)),
        cloture: prochaine && new Date(prochaine).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }),
      },
      terminees: {
        nombre: closes.length,
        candidats: somme(closes, 'candidats'),
        testes: somme(closes, 'testes'),
        moyenne: notees.length
          ? Math.round(notees.reduce((n, c) => n + c.moyenne * c.testes, 0) / somme(notees, 'testes'))
          : null,
      },
    }
  }, [recrutement])
  const competences = useMemo(() => syntheseCompetences(perimetre), [perimetre])
  const pif = useMemo(() => synthesePIF(perimetre), [perimetre])
  const personnes = useMemo(() => synthesePersonnes(perimetre), [perimetre])

  if (!user) return null

  return (
    <>
      <Nav />
      <PortalStickyBar user={user} headerRef={headerRef} />
      <main className="portal-page">
        <div ref={headerRef}>
          <PortalHeader user={user} />
        </div>

        {/* ── Ce qui attend une action ─────────────────────────── */}
        <PortalReveal id="a-traiter">
          <div className="container" style={{ padding: '16px 32px' }}>
            <div className="portal-section-head">
              <p className="portal-section-eyebrow">Priorité — ressources humaines</p>
              <h2 className="portal-section-title">À traiter</h2>
            </div>
            <div className="portal-plan-filters portal-plan-filters--compact" role="group" aria-label="Périmètre">
              {!filialeFixe && (
                <label className="portal-plan-filter-field">
                  <span>Filiale</span>
                  <select disabled value={perimetre.filiale ?? ''}
                    onChange={e => changer({ filiale: e.target.value || null })}>
                    <option value="">Toutes les filiales</option>
                    {filiales().map(f => <option key={f.code} value={f.code}>{f.pays}</option>)}
                  </select>
                </label>
              )}
              <label className="portal-plan-filter-field">
                <span>BU</span>
                <select disabled value={perimetre.bu ?? ''} onChange={e => changer({ bu: e.target.value || null })}>
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
                      accentColor="#E3001B"
                      cta="Traiter"
                      hoverHint="Ouvrir l’espace concerné"
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
            <TeteSection surtitre="Campagnes et résultats" titre="Recrutement" />
            <PortalStaggerGrid>
              <div className="portal-card-anchor">
                <PvCard
                  img={VISUEL.personnes}
                  kicker={<span className="portal-status-chip todo">Préparer</span>}
                  title="Créer une campagne"
                  meta="Poste, filiale, BU, dates et épreuve, puis import des candidats depuis Excel."
                  accentColor="#E3001B"
                  cta="Créer"
                  hoverHint="Créer une campagne de recrutement"
                  corner
                />
              </div>
              <div className="portal-card-anchor">
                <PvCard
                  img={VISUEL.recrutement}
                  kicker={<span className={`portal-status-chip ${enCours.nombre ? 'progress' : 'todo'}`}>
                    {enCours.nombre ? `${enCours.nombre} ouverte${enCours.nombre > 1 ? 's' : ''}` : 'Aucune ouverte'}
                  </span>}
                  title="Campagnes en cours"
                  meta={enCours.nombre ? (
                    <div style={{ display: 'grid', gap: 10 }}>
                      <Progression libelle="Candidats testés" valeur={enCours.avancement}
                        droite={`${enCours.testes}/${enCours.candidats}`} />
                      {/* Le score n'est publie qu'a la cloture de la campagne. */}
                      <Progression libelle="Score moyen" attente droite="En attente" />
                      {enCours.cloture && <span>Prochaine clôture : {enCours.cloture}</span>}
                    </div>
                  ) : 'Aucune campagne ouverte en ce moment.'}
                  cta="Suivre"
                  hoverHint="Suivre, modifier, relancer ou clôturer"
                  corner
                />
              </div>
              <div className="portal-card-anchor">
                <PvCard
                  img={VISUEL.competences}
                  kicker={<span className="portal-status-chip done">
                    {terminees.nombre} clôturée{terminees.nombre > 1 ? 's' : ''}
                  </span>}
                  title="Campagnes terminées"
                  meta={terminees.nombre ? (
                    <div style={{ display: 'grid', gap: 10 }}>
                      <Progression libelle="Candidats testés"
                        valeur={Math.round(100 * terminees.testes / (terminees.candidats || 1))}
                        droite={`${terminees.testes}/${terminees.candidats}`} />
                      <Progression libelle="Score moyen" valeur={terminees.moyenne}
                        droite={terminees.moyenne != null ? `${terminees.moyenne} %` : '—'} />
                    </div>
                  ) : 'Aucune campagne clôturée.'}
                  cta="Exploiter les résultats"
                  hoverHint="Classements, décisions et export"
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
              titre="Compétences" />
            {competences.parFiliale.length > 0 && (
              <PortalStaggerGrid>
                {competences.parFiliale.map(f => (
                  <CartePays key={f.code} f={f}
                    titre={f.moyenne != null ? `Maîtrise globale des compétences : ${f.moyenne} %` : 'Pas encore de score'}
                    meta={<Progression libelle="Techniciens évalués" valeur={f.couverture}
                      droite={`${f.evalues}/${f.techniciens}`} />} />
                ))}
              </PortalStaggerGrid>
            )}
          </div>
        </PortalReveal>

        {/* ── PIF : par filiale et par BU ──────────────────────── */}
        <PortalReveal id="pif">
          <div className="container" style={{ padding: '16px 32px' }}>
            <TeteSection surtitre="Plans individuels de formation" titre="PIF par filiale et BU" />
            {pif.parFiliale.length > 0 && (
              <PortalStaggerGrid>
                {pif.parFiliale.map(f => (
                  <CartePays key={f.code} f={f}
                    titre={f.valides ? `${f.valides} PIF validé${f.valides > 1 ? 's' : ''}` : 'Aucun PIF validé'}
                    meta={<Progression libelle="Techniciens avec PIF" valeur={f.couverture}
                      droite={`${f.avecPif}/${f.techniciens}`} />} />
                ))}
              </PortalStaggerGrid>
            )}
          </div>
        </PortalReveal>

        {/* ── Techniciens & candidats : fiches, import, corbeille ─────────────── */}
        <PortalReveal id="personnes">
          <div className="container" style={{ padding: '16px 32px' }}>
            <TeteSection surtitre="Fiches, import et corbeille" titre="Techniciens & candidats" />
            <PortalStaggerGrid>
              <div className="portal-card-anchor">
                <PvCard
                  img="/assets/img_cards/test_theorie_senior.jpg"
                  kicker={<span className="portal-status-chip todo">Créer</span>}
                  title="Ajouter un collaborateur"
                  meta="Candidat ou technicien : une fiche, ou plusieurs par import Excel."
                  accentColor="#E3001B"
                  cta="Ajouter"
                  hoverHint="Créer une fiche candidat ou technicien"
                  corner
                />
              </div>
              <div className="portal-card-anchor">
                <PvCard
                  img="/assets/img_cards/test_theorie_expert.jpg"
                  kicker={<span className="portal-status-chip progress">
                    {personnes.candidats} actif{personnes.candidats > 1 ? 's' : ''}
                  </span>}
                  title="Candidats"
                  meta="Consulter, modifier, supprimer. Un candidat retenu passe technicien."
                  cta="Gérer"
                  hoverHint="Liste des candidats"
                  corner
                />
              </div>
              <div className="portal-card-anchor">
                <PvCard
                  img={VISUEL.personnes}
                  kicker={<span className="portal-status-chip done">
                    {personnes.techniciens} actif{personnes.techniciens > 1 ? 's' : ''}
                  </span>}
                  title="Techniciens"
                  meta={<Progression libelle="Fiches complètes"
                    valeur={Math.round(100 * (personnes.techniciens - personnes.aCompleter) / (personnes.techniciens || 1))}
                    droite={`${personnes.techniciens - personnes.aCompleter}/${personnes.techniciens}`} />}
                  cta="Gérer"
                  hoverHint="Consulter, modifier, supprimer"
                  corner
                />
              </div>
              <div className="portal-card-anchor">
                <PvCard
                  img="/assets/img_cards/test_pratique_expert.jpg"
                  kicker={<span className="portal-status-chip todo">
                    {personnes.supprimes} fiche{personnes.supprimes > 1 ? 's' : ''}
                  </span>}
                  title="Corbeille"
                  meta="Fiches supprimées, avec date, auteur et motif : restaurer en un clic."
                  cta="Ouvrir"
                  hoverHint="Restaurer une fiche supprimée"
                  corner
                />
              </div>
            </PortalStaggerGrid>
          </div>
        </PortalReveal>

      </main>

      <Footer />
      <PortalDemoBar />
    </>
  )
}
