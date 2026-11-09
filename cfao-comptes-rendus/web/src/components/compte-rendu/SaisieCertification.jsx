import { useRef } from 'react'
import { SEUIL, lireNote, nettoyerNote } from '../../utils/baremeCfao'
import {
  calculerCertification, moduleVide, STATUTS_ELEARNING, CERTIFIE, VALIDE,
} from '../../utils/certification'

/**
 * Les notes d'une certification pratique : un module par ligne, un
 * candidat par colonne — la disposition du classeur « Résultats de la
 * certification », que les formateurs connaissent.
 *
 * Les modules viennent du catalogue quand la certification y figure ;
 * on en ajoute ou en retire sans avoir a annoncer leur nombre. Sous les
 * notes, dans les memes colonnes, ce qui se calcule (total, pourcentage,
 * partie pratique), puis l'e-learning et le resultat final : un candidat
 * se lit de haut en bas, d'un seul regard.
 *
 * La saisie va vite : Entree descend au module suivant, et une plage
 * copiee dans Excel se colle d'un coup a partir de la case choisie.
 */
export default function SaisieCertification({ brouillon, maj, onEffacer }) {
  const table = useRef(null)
  const modules = brouillon.modules || []
  const candidats = (brouillon.participants || []).filter(p => p.present !== false)

  function majModule(id, champ, valeur) {
    maj({ modules: modules.map(m => (m.id === id ? { ...m, [champ]: valeur } : m)) })
  }

  function ajouterModule() {
    maj({ modules: [...modules, moduleVide()] })
    // La nouvelle ligne recoit le curseur : on tape son code aussitot.
    setTimeout(() => {
      const champs = table.current?.querySelectorAll('.cr-module-code')
      champs?.[champs.length - 1]?.focus()
    }, 0)
  }

  function retirerModule(m) {
    const notee = candidats.some(p => String(p.notesModules?.[m.id] ?? '').trim())
    if (notee && !window.confirm(
      `Retirer le module ${m.code || m.intitule || ''} et ses notes ?`)) return
    maj({ modules: modules.filter(x => x.id !== m.id) })
  }

  // Une note est un entier de 0 a 100 ; le reste est ecarte a la frappe.
  const nettoyer = v => String(v ?? '').replace(/[^\d]/g, '').slice(0, 3)

  function noter(idCandidat, idModule, valeur) {
    maj(b => ({
      participants: b.participants.map(p => (p.id === idCandidat
        ? { ...p, notesModules: { ...(p.notesModules || {}), [idModule]: nettoyerNote(valeur) } }
        : p)),
    }))
  }

  function majElearning(idCandidat, champ, valeur) {
    maj(b => ({
      participants: b.participants.map(p => (p.id === idCandidat
        ? { ...p, elearning: { ...(p.elearning || {}), [champ]: valeur } }
        : p)),
    }))
  }

  /** Entree : le module suivant, meme candidat. */
  function suivant(e, ligne, colonne) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    table.current?.querySelector(`[data-note="${ligne + 1}:${colonne}"]`)?.focus()
  }

  /** Une plage copiee d'Excel : des lignes, des tabulations. */
  function coller(e, ligne, colonne) {
    const texte = e.clipboardData?.getData('text') || ''
    if (!/[\t\n]/.test(texte.trim())) return
    e.preventDefault()
    const lignes = texte.replace(/\r/g, '').replace(/\n$/, '').split('\n').map(l => l.split('\t'))
    maj(b => {
      const presents = (b.participants || []).filter(p => p.present !== false)
      const suite = { ...Object.fromEntries((b.participants || []).map(p => [p.id, p])) }
      lignes.forEach((cellules, dl) => {
        const m = modules[ligne + dl]
        if (!m) return
        cellules.forEach((v, dc) => {
          const p = presents[colonne + dc]
          if (!p) return
          const courant = suite[p.id]
          suite[p.id] = { ...courant, notesModules: { ...(courant.notesModules || {}), [m.id]: nettoyerNote(v) } }
        })
      })
      return { participants: (b.participants || []).map(p => suite[p.id]) }
    })
  }

  const calculs = Object.fromEntries(candidats.map(p => [p.id, calculerCertification(p, modules)]))
  const colonnes = candidats.length

  return (
    <div className="cr-certif-wrap">
      <table className="cr-certif" ref={table}>
        <colgroup>
          <col className="cr-certif-col-module" />
          {candidats.map(p => <col key={p.id} className="cr-certif-col" />)}
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="cr-certif-coin">
              Module <small>note sur 100</small>
            </th>
            {candidats.map(p => (
              <th key={p.id} scope="col" className="cr-certif-nom" title={`${p.prenom} ${p.nom}`}>
                <span className="cr-certif-nom-texte">{p.prenom} {p.nom}</span>
                <small>{calculs[p.id].saisies}/{modules.length}</small>
                {onEffacer && (calculs[p.id].saisies > 0
                  || Object.values(p.elearning || {}).some(v => String(v ?? '').trim())) && (
                  <button type="button" className="cr-effacer-un cr-effacer-un--tete"
                    onClick={() => onEffacer(p)}
                    title={`Effacer les notes de ${p.prenom} ${p.nom}`}
                    aria-label={`Effacer les notes de ${p.prenom} ${p.nom}`}>↺</button>
                )}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {modules.map((m, i) => (
            <tr key={m.id}>
              <th scope="row" className="cr-certif-module">
                <input className="cr-module-code" value={m.code}
                  onChange={e => majModule(m.id, 'code', e.target.value.toUpperCase())}
                  placeholder="Code" aria-label={`Code du module ${i + 1}`} />
                <input className="cr-module-intitule" value={m.intitule}
                  onChange={e => majModule(m.id, 'intitule', e.target.value)}
                  placeholder="Intitulé du module" title={m.intitule}
                  aria-label={`Intitulé du module ${i + 1}`} />
                <button type="button" className="cr-module-retirer"
                  onClick={() => retirerModule(m)}
                  title="Retirer ce module" aria-label={`Retirer le module ${m.code || i + 1}`}>×</button>
              </th>
              {candidats.map((p, j) => {
                const v = p.notesModules?.[m.id] ?? ''
                const n = lireNote(v)
                return (
                  <td key={p.id}>
                    <input
                      className={`cr-num cr-certif-note${n != null && n > 100 ? ' cr-num--erreur'
                        : n != null && n < SEUIL ? ' cr-certif-note--bas' : ''}`}
                      data-note={`${i}:${j}`}
                      type="text" inputMode="decimal" value={v} placeholder="—"
                      onChange={e => noter(p.id, m.id, e.target.value)}
                      onKeyDown={e => suivant(e, i, j)}
                      onPaste={e => coller(e, i, j)}
                      aria-label={`${libelle(m, i)} — ${p.prenom} ${p.nom}`} />
                  </td>
                )
              })}
            </tr>
          ))}
          {/* Le bouton est dans la colonne des modules, figee comme elle :
              il reste en place quand on fait defiler les candidats. */}
          <tr className="cr-certif-ajout">
            <th scope="row" className="cr-certif-libelle">
              <button type="button" className="cr-btn cr-btn--ghost cr-btn--petit" onClick={ajouterModule}>
                + Ajouter un module
              </button>
            </th>
            <td colSpan={colonnes} />
          </tr>
        </tbody>

        <tbody className="cr-certif-calculs">
          <Ligne titre={`Total sur ${100 * modules.length}`} candidats={candidats}>
            {p => {
              const c = calculs[p.id]
              return c.complet ? <span className="cr-calc">{c.total}</span>
                : <span className="cr-calc cr-calc--vide">{c.saisies}/{modules.length} notes</span>
            }}
          </Ligne>
          <Ligne titre="Pourcentage" candidats={candidats}>
            {p => {
              const c = calculs[p.id]
              return (
                <span className={`cr-calc${c.pourcentage == null ? ' cr-calc--vide'
                  : c.pourcentage >= SEUIL ? ' cr-calc--ok' : ' cr-calc--ko'}`}>
                  {c.pourcentage == null ? '—' : `${c.pourcentage} %`}
                </span>
              )
            }}
          </Ligne>
          <Ligne titre="Partie pratique" sousTitre={`validée à ${SEUIL} %`} candidats={candidats}>
            {p => <Statut valeur={calculs[p.id].pratique} bon={VALIDE} />}
          </Ligne>
        </tbody>

        <tbody className="cr-certif-elearning">
          <tr className="cr-certif-section">
            <th scope="rowgroup">E-learning</th>
            <td colSpan={colonnes} />
          </tr>
          <Ligne titre="Modules requis" candidats={candidats}>
            {p => (
              <input className="cr-num cr-certif-note" type="text" inputMode="numeric"
                value={p.elearning?.requis ?? ''} placeholder="—"
                onChange={e => majElearning(p.id, 'requis', nettoyer(e.target.value))}
                aria-label={`Modules e-learning requis — ${p.prenom} ${p.nom}`} />
            )}
          </Ligne>
          <Ligne titre="Modules validés" candidats={candidats}>
            {p => (
              <input className="cr-num cr-certif-note" type="text" inputMode="numeric"
                value={p.elearning?.valides ?? ''} placeholder="—"
                onChange={e => majElearning(p.id, 'valides', nettoyer(e.target.value))}
                aria-label={`Modules e-learning validés — ${p.prenom} ${p.nom}`} />
            )}
          </Ligne>
          <Ligne titre="Taux de participation" candidats={candidats}>
            {p => {
              const t = calculs[p.id].elearning.taux
              return <span className={`cr-calc${t == null ? ' cr-calc--vide' : ''}`}>{t == null ? '—' : `${t} %`}</span>
            }}
          </Ligne>
          <Ligne titre="Statut" sousTitre="donné par la plateforme" candidats={candidats}>
            {p => (
              <div className="cr-certif-statuts" role="radiogroup"
                aria-label={`Statut e-learning — ${p.prenom} ${p.nom}`}>
                {STATUTS_ELEARNING.map(s => {
                  const on = p.elearning?.statut === s
                  return (
                    <button key={s} type="button" role="radio" aria-checked={on}
                      className={`cr-certif-statut${on ? ` cr-certif-statut--on cr-certif-statut--${s === VALIDE ? 'ok' : 'ko'}` : ''}`}
                      onClick={() => majElearning(p.id, 'statut', on ? '' : s)}>
                      {s}
                    </button>
                  )
                })}
              </div>
            )}
          </Ligne>
        </tbody>

        <tbody className="cr-certif-final">
          <Ligne titre="Résultat final" candidats={candidats}>
            {p => <Statut valeur={calculs[p.id].final} bon={CERTIFIE} fort />}
          </Ligne>
        </tbody>
      </table>
    </div>
  )
}

const libelle = (m, i) => m.code || m.intitule || `Module ${i + 1}`

/** Une ligne de resultats, une case par candidat. */
function Ligne({ titre, sousTitre, candidats, children }) {
  return (
    <tr>
      <th scope="row" className="cr-certif-libelle">
        {titre}
        {sousTitre && <small>{sousTitre}</small>}
      </th>
      {candidats.map(p => <td key={p.id}>{children(p)}</td>)}
    </tr>
  )
}

/** Un resultat en pastille : vert s'il est bon, orange sinon, gris s'il manque. */
function Statut({ valeur, bon, fort }) {
  if (!valeur) return <span className="cr-calc cr-calc--vide">—</span>
  return (
    <span className={`cr-certif-pastille cr-certif-pastille--${valeur === bon ? 'ok' : 'ko'}${fort ? ' cr-certif-pastille--fort' : ''}`}>
      {valeur}
    </span>
  )
}
