import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import useAdminResource, { fetchAllPages } from '../hooks/useAdminResource.js'
import { libelleType } from '../utils/typesProposition.js'
import { NON_RETENUE, STATUTS, estTerminee, libelleEtape, statutDe } from '../utils/etapesProposition.js'

const REPONSE_MAX = 500

/** Aujourd'hui en AAAA-MM-JJ (heure locale), borne basse de la date prévue. */
function aujourdhui() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Suivi d'une proposition : son étape, et sur demande le formulaire pour la
 * changer (étape, date prévue si Planifiée, mot pour l'auteur — motif
 * obligatoire si Non retenue). L'auteur voit tout cela sur « Mes propositions ».
 */
export function SuiviLigne({ ligne, t, locale, onMaj }) {
  const [ouvert, setOuvert] = useState(false)
  const [statut, setStatut] = useState(statutDe(ligne))
  const [echeance, setEcheance] = useState(ligne.echeance ?? '')
  const [reponse, setReponse] = useState(ligne.reponse_equipe ?? '')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const id = `suivi-${ligne.id}`

  const ouvrir = () => {
    setStatut(statutDe(ligne))
    setEcheance(ligne.echeance ?? '')
    setReponse(ligne.reponse_equipe ?? '')
    setErreur(null)
    setOuvert(true)
  }

  const enregistrer = async e => {
    e.preventDefault()
    if (statut === 'planifiee' && !echeance) { setErreur(t.sa_suggestions_echeance_requise); return }
    if (statut === NON_RETENUE && !reponse.trim()) { setErreur(t.sa_suggestions_motif_requis); return }
    setEnvoi(true)
    setErreur(null)
    try {
      const corps = { statut, reponse_equipe: reponse.trim() }
      if (statut === 'planifiee') corps.echeance = echeance
      const maj = await api.suggestions.suivre(ligne.id, corps)
      onMaj({ ...maj, id: ligne.id })
      setOuvert(false)
    } catch {
      setErreur(t.sa_suggestions_echec)
    } finally {
      setEnvoi(false)
    }
  }

  if (!ouvert) {
    return (
      <>
        <span className={`mes-propositions-statut is-${statutDe(ligne)}`}>{libelleEtape(ligne, t, locale)}</span>
        <button type="button" className="portal-btn portal-btn-ghost portal-suggestions-changer" onClick={ouvrir}>
          {t.sa_suggestions_changer}
        </button>
      </>
    )
  }

  return (
    <form className="portal-suggestions-form" onSubmit={enregistrer} noValidate>
      <label htmlFor={`${id}-etape`}>{t.sa_suggestions_etape}</label>
      <select id={`${id}-etape`} value={statut} onChange={e => setStatut(e.target.value)}>
        {STATUTS.map(s => <option key={s} value={s}>{t[`proposition_etape_${s}`]}</option>)}
      </select>
      {statut === 'planifiee' ? (
        <>
          <label htmlFor={`${id}-date`}>{t.sa_suggestions_echeance}</label>
          <input id={`${id}-date`} type="date" min={aujourdhui()} value={echeance} onChange={e => setEcheance(e.target.value)} required />
        </>
      ) : null}
      <label htmlFor={`${id}-mot`}>{statut === NON_RETENUE ? t.sa_suggestions_motif : t.sa_suggestions_mot}</label>
      <textarea
        id={`${id}-mot`}
        rows={3}
        maxLength={REPONSE_MAX}
        value={reponse}
        onChange={e => setReponse(e.target.value)}
        placeholder={t.sa_suggestions_mot_aide}
        required={statut === NON_RETENUE}
      />
      {erreur ? <span className="portal-suggestions-echec" role="alert">{erreur}</span> : null}
      <span className="portal-suggestions-form-actions">
        <button type="submit" className="portal-btn portal-btn-primary" disabled={envoi}>{t.sa_suggestions_enregistrer}</button>
        <button type="button" className="portal-btn portal-btn-ghost" onClick={() => setOuvert(false)} disabled={envoi}>{t.sa_suggestions_annuler}</button>
      </span>
    </form>
  )
}

/**
 * Propositions de modification envoyées depuis la barre d'aperçu d'un portail
 * (« Proposer une modification »). Lecture et suivi réservés au super admin :
 * core filtre la liste, ici on n'affiche que ce qu'il renvoie.
 */
export default function PropositionsPortails({ t, locale = 'fr' }) {
  const source = useAdminResource(() => fetchAllPages(api.suggestions.lister), [])
  const [lignes, setLignes] = useState([])
  const [filtre, setFiltre] = useState('')

  useEffect(() => { if (source.status === 'ready') setLignes(source.data ?? []) }, [source])

  if (source.status === 'offline' || source.status === 'loading') return null
  if (source.status !== 'ready') return <p className="portal-apercu-vu-comme-note">{t.sa_suggestions_indispo}</p>
  if (!lignes.length) return <p className="portal-apercu-vu-comme-note" data-testid="suggestions-vide">{t.sa_suggestions_vide}</p>

  const dateDe = iso => {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
  }

  // Types présents dans la liste, pour le filtre (libellé affiché → valeur stockée).
  const types = [...new Set(lignes.map(l => l.type).filter(Boolean))]
    .map(v => ({ v, libelle: libelleType(v, t) }))
    .sort((a, b) => a.libelle.localeCompare(b.libelle, locale))
  const visibles = filtre ? lignes.filter(l => l.type === filtre) : lignes

  const remplacer = maj => setLignes(ls => ls.map(l => (l.id === maj.id ? { ...l, ...maj } : l)))

  return (
    <>
    {types.length > 0 && (
      <p className="portal-suggestions-filtre">
        <label htmlFor="suggestions-filtre-type">{t.sa_suggestions_filtre}</label>
        <select id="suggestions-filtre-type" value={filtre} onChange={e => setFiltre(e.target.value)}>
          <option value="">{t.sa_suggestions_tous_types}</option>
          {types.map(({ v, libelle }) => <option key={v} value={v}>{libelle}</option>)}
        </select>
      </p>
    )}
    <div className="portal-suggestions-table-wrap">
      <table className="portal-suggestions-table" data-testid="suggestions-liste">
        <thead>
          <tr>
            <th scope="col">{t.sa_suggestions_col_date}</th>
            <th scope="col">{t.sa_suggestions_col_auteur}</th>
            <th scope="col">{t.sa_suggestions_col_portail}</th>
            <th scope="col">{t.sa_suggestions_col_partie}</th>
            <th scope="col">{t.sa_suggestions_col_type}</th>
            <th scope="col">{t.sa_suggestions_col_message}</th>
            <th scope="col">{t.sa_suggestions_col_suivi}</th>
          </tr>
        </thead>
        <tbody>
          {visibles.map(l => (
            <tr key={l.id} className={estTerminee(l) ? 'is-terminee' : undefined}>
              <td>{dateDe(l.created_at)}</td>
              <td>{l.auteur_nom}</td>
              <td>
                {t[`role_${l.role_vu}`] ?? l.role_vu}
                <span className="portal-suggestions-chemin">{l.chemin}</span>
              </td>
              <td>{l.section || t.apercu_proposer_toute_page}</td>
              <td>{l.type ? libelleType(l.type, t) : ''}</td>
              <td className="portal-suggestions-message">{l.message}</td>
              <td className="portal-suggestions-suivi">
                <SuiviLigne ligne={l} t={t} locale={locale} onMaj={remplacer} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  )
}
