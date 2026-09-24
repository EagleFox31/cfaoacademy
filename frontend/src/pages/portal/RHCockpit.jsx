import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import CockpitShell, { CockpitBar } from '../../components/cockpit/CockpitShell'
import CockpitSkeleton from '../../components/delivery/CockpitSkeleton'
import useSiteEffects from '../../hooks/useSiteEffects'
import useAuth from '../../hooks/useAuth'
import usePortalBackground from '../../hooks/usePortalBackground'
import {
  BU, NIVEAUX, PERIMETRE_GROUPE, filiales, nomFiliale, priorites,
  syntheseRecrutement, syntheseCompetences, synthesePIF, synthesePersonnes,
} from '../../utils/rhDonnees'

/** Les sections RH, dans l'ordre du cycle : preparer, exploiter, former, gerer. */
const NAV = [
  { group: 'Pilotage', items: [
    { id: 'overview', ico: '◰', label: 'Vue d’ensemble' },
  ] },
  { group: 'Campagnes', items: [
    { id: 'recrutement', ico: '☰', label: 'Recrutement' },
    { id: 'mesure', ico: '⌗', label: 'Mesure des compétences' },
  ] },
  { group: 'Exploitation', items: [
    { id: 'res-recrutement', ico: '▤', label: 'Résultats recrutement' },
    { id: 'res-competences', ico: '▦', label: 'Résultats compétences' },
  ] },
  { group: 'Formation', items: [
    { id: 'pif', ico: '⚑', label: 'PIF filiales et BU' },
  ] },
  { group: 'Administration', items: [
    { id: 'utilisateurs', ico: '⇄', label: 'Utilisateurs' },
  ] },
]

/** Vue qui traite chaque priorite. */
const VUE_DE = { recrutement: 'recrutement', competences: 'mesure', pif: 'pif', personnes: 'utilisateurs' }
const LETTRE = { recrutement: 'R', competences: 'C', pif: 'P', personnes: 'U' }

const pct = v => (v == null ? '—' : v)
const date = iso => (iso ? iso.slice(2).split('-').reverse().join('.') : '—')
const etat = couverture => (couverture >= 80 ? 'done' : couverture >= 50 ? 'progress' : 'todo')
const ETAT = { done: 'Couverte', progress: 'En cours', todo: 'En retard' }

/** Couverture en cellule de tableau : barre et valeur. */
function Cellule({ n, total, valeur }) {
  if (!total) return <span className="dlv-hint">—</span>
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '56px 120px 44px', alignItems: 'center', gap: 10 }}>
      <span>{n} / {total}</span>
      <CockpitBar pct={valeur ?? 0} tone={valeur >= 80 ? '' : 'navy'} />
      <span>{pct(valeur)} %</span>
    </div>
  )
}

/**
 * Portail RH — cockpit groupe.
 *
 * Meme cadre que le pilotage projet (`CockpitShell`) : barre laterale par
 * theme, indicateurs, lignes d'avancement, tableaux. Les sections suivent le
 * cycle RH retenu : campagnes (recrutement, mesure des competences), puis
 * leur exploitation, les PIF par filiale et BU, et les utilisateurs.
 *
 * Le perimetre (filiale, BU) vaut pour toutes les vues. La RH filiale
 * reprendra ce cockpit avec sa filiale fixee (`filialeFixe`).
 */
export default function RHCockpit({ filialeFixe = null }) {
  useSiteEffects()
  const { user } = useAuth()
  usePortalBackground(user)
  const [view, setView] = useState('overview')
  const [perimetre, setPerimetre] = useState({ ...PERIMETRE_GROUPE, filiale: filialeFixe })
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    const id = setTimeout(() => setBooting(false), 550)
    return () => clearTimeout(id)
  }, [])

  const aTraiter = useMemo(() => priorites(perimetre), [perimetre])
  const recrutement = useMemo(() => syntheseRecrutement(perimetre), [perimetre])
  const competences = useMemo(() => syntheseCompetences(perimetre), [perimetre])
  const pif = useMemo(() => synthesePIF(perimetre), [perimetre])
  const personnes = useMemo(() => synthesePersonnes(perimetre), [perimetre])

  if (!user) return <Navigate to="/login" replace />
  if (!user.roles?.includes('group_hr')) return <Navigate to="/portail" replace />

  const compte = {
    recrutement: recrutement.campagnes.length,
    mesure: competences.parFiliale.length,
    utilisateurs: personnes.techniciens + personnes.candidats,
  }
  const libellePerimetre = `${perimetre.filiale ? nomFiliale(perimetre.filiale) : 'Groupe'} · ${
    perimetre.bu ?? 'Toutes BU'}`
  const buAffichees = perimetre.bu ? [perimetre.bu] : BU

  return (
    <CockpitShell
      brand={{ badge: 'RH', title: 'CFAO Academy', subtitle: 'Ressources humaines' }}
      nav={NAV.map(grp => ({
        ...grp,
        items: grp.items.map(it => ({ ...it, count: compte[it.id] })),
      }))}
      view={view}
      onView={setView}
      eyebrow="Ressources humaines · Groupe"
      title="Pilotage RH"
      lead="Campagnes de recrutement et de mesure des compétences, exploitation des résultats, PIF par filiale et BU, utilisateurs."
      chips={(
        <>
          <span className="dlv-week-chip">{libellePerimetre}</span>
          <span className="dlv-role-chip">{user.firstName} {user.lastName} · RH Groupe</span>
        </>
      )}
      banner={(
        <div className="dlv-readonly">
          Données de démonstration issues de MEDACAP, anonymisées — les actions
          (créer, importer, valider) arrivent avec chaque espace.
        </div>
      )}
      backPortalLabel="Votre portail"
      backSiteLabel="Retour au site"
    >
      {booting ? <CockpitSkeleton /> : (
        <>
          {perimetreBarre()}
          {view === 'overview' && vueEnsemble()}
          {view === 'recrutement' && vueRecrutement()}
          {view === 'mesure' && vueMesure()}
          {view === 'res-recrutement' && vueResultatsRecrutement()}
          {view === 'res-competences' && vueResultatsCompetences()}
          {view === 'pif' && vuePIF()}
          {view === 'utilisateurs' && vueUtilisateurs()}
        </>
      )}
    </CockpitShell>
  )

  /* ───────────────────── BRIQUES ───────────────────── */

  function perimetreBarre() {
    return (
      <div className="dlv-toolbar">
        {!filialeFixe && (
          <select className="dlv-field" aria-label="Filiale" value={perimetre.filiale ?? ''}
            onChange={e => setPerimetre(p => ({ ...p, filiale: e.target.value || null }))}>
            <option value="">Toutes les filiales</option>
            {filiales().map(f => <option key={f.code} value={f.code}>{f.pays}</option>)}
          </select>
        )}
        <select className="dlv-field" aria-label="BU" value={perimetre.bu ?? ''}
          onChange={e => setPerimetre(p => ({ ...p, bu: e.target.value || null }))}>
          <option value="">Toutes les BU</option>
          {BU.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>
    )
  }

  function tete(titre, sousTitre) {
    return (
      <div className="dlv-view-head">
        <h2>{titre}</h2>
        <p>{sousTitre}</p>
      </div>
    )
  }

  /** Une filiale en ligne d'avancement : couverture de la mesure. */
  function ligneFiliale(f) {
    const e = etat(f.couverture ?? 0)
    return (
      <div key={f.code} className="dlv-proj" role="button" tabIndex={0} style={{ cursor: 'pointer' }}
        title={`Restreindre à ${f.pays}`}
        onClick={() => setPerimetre(p => ({ ...p, filiale: f.code }))}>
        <span className={`dlv-proj-id ${e === 'todo' ? 'crit' : ''}`}>{f.code.toUpperCase()}</span>
        <div className="dlv-proj-main">
          <div className="dlv-proj-top">
            <b>{f.pays}</b>
            <span className="dlv-proj-mod">{f.techniciens} techniciens</span>
            {BU.filter(b => f.parBU[b].techniciens).map(b => (
              <span key={b} className="dlv-chip phase">{b} {f.parBU[b].evalues}/{f.parBU[b].techniciens}</span>
            ))}
            {f.moyenne != null && <span className="dlv-chip te">Moyenne {f.moyenne} %</span>}
            <span className={`dlv-proj-state ${e}`}>{ETAT[e]}</span>
          </div>
          <CockpitBar pct={f.couverture ?? 0} tone={e === 'done' ? '' : 'navy'} />
        </div>
        <span className="dlv-proj-pct">
          {pct(f.couverture)}<small>%</small>
          <em>{f.evalues}/{f.techniciens}</em>
        </span>
      </div>
    )
  }

  /* ───────────────────── VUES ───────────────────── */

  function vueEnsemble() {
    const ouvertes = recrutement.campagnes.filter(c => c.statut === 'ouverte')
    const candOuverts = ouvertes.reduce((n, c) => n + c.candidats, 0)
    const testesOuverts = ouvertes.reduce((n, c) => n + c.testes, 0)
    const pctOuverts = candOuverts ? Math.round((testesOuverts / candOuverts) * 100) : 0
    const pctValides = pif.avecPif ? Math.round((pif.valides / pif.avecPif) * 100) : 0
    return (
      <>
        <div className="dlv-kpis">
          <div className="dlv-kpi" style={{ '--dlv-accent': 'var(--dlv-navy)' }}>
            <div className="dlv-kpi-k">Campagnes ouvertes</div>
            <div className="dlv-kpi-v">{ouvertes.length}</div>
            <div className="dlv-kpi-m">{testesOuverts} / {candOuverts} candidats testés</div>
            <CockpitBar pct={pctOuverts} tone="navy" />
          </div>
          <div className="dlv-kpi" style={{ '--dlv-accent': 'var(--dlv-green)' }}>
            <div className="dlv-kpi-k">Mesure des compétences</div>
            <div className="dlv-kpi-v">{pct(competences.couverture)}<small>%</small></div>
            <div className="dlv-kpi-m">{competences.evalues} / {competences.techniciens} techniciens évalués</div>
            <CockpitBar pct={competences.couverture ?? 0} />
          </div>
          <div className="dlv-kpi" style={{ '--dlv-accent': 'var(--dlv-red)' }}>
            <div className="dlv-kpi-k">PIF validés</div>
            <div className="dlv-kpi-v">{pctValides}<small>%</small></div>
            <div className="dlv-kpi-m">{pif.valides} / {pif.avecPif} plans proposés</div>
            <CockpitBar pct={pctValides} tone="red" />
          </div>
          <div className="dlv-kpi" style={{ '--dlv-accent': personnes.aCompleter ? 'var(--dlv-red)' : 'var(--dlv-green)' }}>
            <div className="dlv-kpi-k">Fiches à compléter</div>
            <div className="dlv-kpi-v">{personnes.aCompleter}</div>
            <div className="dlv-kpi-m">Sans filiale, BU ou niveau</div>
          </div>
        </div>

        <div className="dlv-section-title">À traiter</div>
        <p className="dlv-section-sub">Une priorité par section, la plus urgente.</p>
        {aTraiter.length === 0 && <div className="dlv-panel dlv-panel-sub">Rien en attente sur ce périmètre.</div>}
        <div className="dlv-rows">
          {aTraiter.map(a => (
            <div key={a.nature} className="dlv-proj" role="button" tabIndex={0} style={{ cursor: 'pointer' }}
              onClick={() => setView(VUE_DE[a.espace])}>
              <span className="dlv-proj-id crit">{LETTRE[a.espace]}</span>
              <div className="dlv-proj-main">
                <div className="dlv-proj-top">
                  <b>{a.titre}</b>
                  <span className="dlv-proj-mod">{a.detail}</span>
                  <span className="dlv-proj-state todo">{a.nature}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="dlv-section-title">Filiales — couverture de la mesure</div>
        <p className="dlv-section-sub">Techniciens évalués par filiale, du plus en retard au plus avancé. Un clic restreint le périmètre.</p>
        <div className="dlv-rows">{competences.parFiliale.map(ligneFiliale)}</div>
      </>
    )
  }

  function vueRecrutement() {
    return (
      <>
        {tete('Campagnes de recrutement', 'Ouvertes d’abord, puis les plus récentes — avancement des tests par campagne.')}
        <div className="dlv-actions" style={{ marginBottom: 16 }}>
          <button type="button" className="dlv-btn primary" disabled
            title="Création de campagne : arrive avec l’espace Recrutement">
            + Nouvelle campagne
          </button>
        </div>
        {recrutement.campagnes.length === 0 && <div className="dlv-panel dlv-panel-sub">Aucune campagne sur ce périmètre.</div>}
        <div className="dlv-rows">
          {recrutement.campagnes.map((c, i) => (
            <div key={c.id} className="dlv-proj">
              <span className={`dlv-proj-id ${c.statut === 'ouverte' ? 'crit' : ''}`}>R{i + 1}</span>
              <div className="dlv-proj-main">
                <div className="dlv-proj-top">
                  <b>{c.intitule}</b>
                  <span className="dlv-proj-mod">{nomFiliale(c.f)}</span>
                  {c.bu.map(b => <span key={b} className="dlv-chip phase">{b}</span>)}
                  <span className="dlv-chip te">{date(c.debut)} → {date(c.fin)}</span>
                  <span className={`dlv-proj-state ${c.statut === 'ouverte' ? 'progress' : 'done'}`}>
                    {c.statut === 'ouverte' ? 'Ouverte' : 'Clôturée'}
                  </span>
                </div>
                <CockpitBar pct={c.avancement ?? 0} tone={c.statut === 'ouverte' ? 'navy' : ''} />
              </div>
              <span className="dlv-proj-pct">
                {pct(c.avancement)}<small>%</small>
                <em>{c.testes}/{c.candidats}</em>
              </span>
            </div>
          ))}
        </div>
        <p className="dlv-hint">Import des candidats depuis Excel et assignation des tests : à la création de la campagne.</p>
      </>
    )
  }

  function vueMesure() {
    const c = competences.campagne
    return (
      <>
        {tete(c?.intitule ?? 'Mesure des compétences',
          `Campagne ${c?.statut === 'ouverte' ? 'ouverte' : 'clôturée'} · ${date(c?.debut)} → ${date(c?.fin)} · tests factuels et déclaratifs validés par le manager.`)}
        <div className="dlv-kpis">
          <div className="dlv-kpi" style={{ '--dlv-accent': 'var(--dlv-navy)' }}>
            <div className="dlv-kpi-k">Techniciens</div>
            <div className="dlv-kpi-v">{competences.techniciens}</div>
            <div className="dlv-kpi-m">Actifs sur le périmètre</div>
          </div>
          <div className="dlv-kpi" style={{ '--dlv-accent': 'var(--dlv-green)' }}>
            <div className="dlv-kpi-k">Évalués</div>
            <div className="dlv-kpi-v">{competences.evalues}</div>
            <div className="dlv-kpi-m">Factuel + déclaratif validé</div>
            <CockpitBar pct={competences.couverture ?? 0} />
          </div>
          <div className="dlv-kpi" style={{ '--dlv-accent': 'var(--dlv-red)' }}>
            <div className="dlv-kpi-k">Restant à évaluer</div>
            <div className="dlv-kpi-v">{competences.techniciens - competences.evalues}</div>
            <div className="dlv-kpi-m">{competences.parFiliale.filter(f => (f.couverture ?? 0) < 50).length} filiale(s) sous 50 %</div>
          </div>
          <div className="dlv-kpi" style={{ '--dlv-accent': 'var(--dlv-navy)' }}>
            <div className="dlv-kpi-k">Score moyen</div>
            <div className="dlv-kpi-v">{pct(competences.moyenne)}<small>%</small></div>
            <div className="dlv-kpi-m">Dernier test factuel</div>
          </div>
        </div>
        <div className="dlv-section-title">Avancement par filiale</div>
        <div className="dlv-rows">{competences.parFiliale.map(ligneFiliale)}</div>
      </>
    )
  }

  function vueResultatsRecrutement() {
    return (
      <>
        {tete('Résultats du recrutement', 'Candidats testés par campagne et répartition des scores au test factuel.')}
        <table className="dlv-table">
          <thead>
            <tr>
              <th>Campagne</th><th>Filiale</th><th>Testés</th><th>Moyenne</th>
              <th>≥ 70 %</th><th>50–69 %</th><th>&lt; 50 %</th>
            </tr>
          </thead>
          <tbody>
            {recrutement.campagnes.map(c => (
              <tr key={c.id}>
                <td><b>{c.intitule}</b></td>
                <td>{nomFiliale(c.f)}</td>
                <td>{c.testes} / {c.candidats}</td>
                <td>{c.moyenne != null ? `${c.moyenne} %` : '—'}</td>
                <td>{c.repartition.fort}</td>
                <td>{c.repartition.moyen}</td>
                <td>{c.repartition.faible}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="dlv-hint">Décision et passage des candidats retenus au statut de technicien : à venir dans l’espace Recrutement.</p>
      </>
    )
  }

  function vueResultatsCompetences() {
    return (
      <>
        {tete('Résultats des compétences', 'Techniciens évalués par filiale : niveau, score moyen et répartition.')}
        <table className="dlv-table">
          <thead>
            <tr>
              <th>Filiale</th><th>Évalués</th><th>Moyenne</th>
              {NIVEAUX.map(n => <th key={n}>{n}</th>)}
              <th>≥ 70 %</th><th>50–69 %</th><th>&lt; 50 %</th>
            </tr>
          </thead>
          <tbody>
            {competences.parFiliale.map(f => (
              <tr key={f.code}>
                <td><b>{f.pays}</b></td>
                <td>{f.evalues} / {f.techniciens}</td>
                <td>{f.moyenne != null ? `${f.moyenne} %` : '—'}</td>
                {NIVEAUX.map(n => <td key={n}>{f.niveaux[n]}</td>)}
                <td>{f.repartition.fort}</td>
                <td>{f.repartition.moyen}</td>
                <td>{f.repartition.faible}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    )
  }

  function vuePIF() {
    return (
      <>
        {tete('PIF par filiale et BU', 'Plans individuels de formation : techniciens avec un plan, par BU, et plans validés.')}
        <div className="dlv-kpis">
          <div className="dlv-kpi" style={{ '--dlv-accent': 'var(--dlv-navy)' }}>
            <div className="dlv-kpi-k">Techniciens évalués</div>
            <div className="dlv-kpi-v">{pif.evalues}</div>
            <div className="dlv-kpi-m">Base du PIF</div>
          </div>
          <div className="dlv-kpi" style={{ '--dlv-accent': 'var(--dlv-navy)' }}>
            <div className="dlv-kpi-k">Avec un PIF</div>
            <div className="dlv-kpi-v">{pif.avecPif}</div>
            <div className="dlv-kpi-m">{pif.avecPif} / {pif.techniciens} techniciens</div>
            <CockpitBar pct={pif.couverture ?? 0} tone="navy" />
          </div>
          <div className="dlv-kpi" style={{ '--dlv-accent': 'var(--dlv-green)' }}>
            <div className="dlv-kpi-k">PIF validés</div>
            <div className="dlv-kpi-v">{pif.valides}</div>
            <div className="dlv-kpi-m">Par le manager</div>
          </div>
          <div className="dlv-kpi" style={{ '--dlv-accent': 'var(--dlv-red)' }}>
            <div className="dlv-kpi-k">En attente</div>
            <div className="dlv-kpi-v">{Math.max(0, pif.avecPif - pif.valides)}</div>
            <div className="dlv-kpi-m">Plans à valider</div>
          </div>
        </div>
        <table className="dlv-table">
          <thead>
            <tr>
              <th>Filiale</th>
              {buAffichees.map(b => <th key={b}>{b} — PIF / techniciens</th>)}
              <th>Validés</th>
            </tr>
          </thead>
          <tbody>
            {pif.parFiliale.map(f => (
              <tr key={f.code}>
                <td><b>{f.pays}</b></td>
                {buAffichees.map(b => (
                  <td key={b}>
                    <Cellule n={f.parBU[b].avecPif} total={f.parBU[b].techniciens} valeur={f.parBU[b].couverture} />
                  </td>
                ))}
                <td>{f.valides}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    )
  }

  function vueUtilisateurs() {
    return (
      <>
        {tete('Utilisateurs', 'Candidats et techniciens par filiale — suppression douce : un utilisateur supprimé va en corbeille et reste restaurable.')}
        <div className="dlv-kpis">
          <div className="dlv-kpi" style={{ '--dlv-accent': 'var(--dlv-navy)' }}>
            <div className="dlv-kpi-k">Techniciens actifs</div>
            <div className="dlv-kpi-v">{personnes.techniciens}</div>
            <div className="dlv-kpi-m">Sur le périmètre</div>
          </div>
          <div className="dlv-kpi" style={{ '--dlv-accent': 'var(--dlv-navy)' }}>
            <div className="dlv-kpi-k">Candidats</div>
            <div className="dlv-kpi-v">{personnes.candidats}</div>
            <div className="dlv-kpi-m">Toutes campagnes</div>
          </div>
          <div className="dlv-kpi" style={{ '--dlv-accent': 'var(--dlv-green)' }}>
            <div className="dlv-kpi-k">Corbeille</div>
            <div className="dlv-kpi-v">{personnes.supprimes}</div>
            <div className="dlv-kpi-m">Supprimés, restaurables</div>
          </div>
          <div className="dlv-kpi" style={{ '--dlv-accent': 'var(--dlv-red)' }}>
            <div className="dlv-kpi-k">Fiches à compléter</div>
            <div className="dlv-kpi-v">{personnes.aCompleter}</div>
            <div className="dlv-kpi-m">Exclues des statistiques</div>
          </div>
        </div>
        <table className="dlv-table">
          <thead>
            <tr><th>Filiale</th><th>Techniciens</th><th>Candidats</th><th>Corbeille</th><th>À compléter</th></tr>
          </thead>
          <tbody>
            {personnes.parFiliale.map(f => (
              <tr key={f.code ?? 'sans'}>
                <td><b>{f.pays}</b></td>
                <td>{f.techniciens}</td>
                <td>{f.candidats}</td>
                <td>{f.supprimes}</td>
                <td>{f.aCompleter}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="dlv-grid-2" style={{ marginTop: 16 }}>
          <div className="dlv-panel">
            <div className="dlv-panel-k">Gestion</div>
            <h4>Candidats et techniciens</h4>
            <ul>
              <li>Créer, modifier, supprimer un candidat ou un technicien</li>
              <li>Filiale, BU (Motors, Equipment) et niveau obligatoires</li>
              <li>Passage d’un candidat retenu au statut de technicien</li>
            </ul>
          </div>
          <div className="dlv-panel">
            <div className="dlv-panel-k">Suppression douce</div>
            <h4>Corbeille</h4>
            <ul>
              <li>Date, auteur et motif de chaque suppression</li>
              <li>Restauration à tout moment</li>
              <li>Exclus des listes et des statistiques</li>
            </ul>
          </div>
        </div>
      </>
    )
  }
}
