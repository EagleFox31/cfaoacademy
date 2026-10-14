import { useEffect, useState } from 'react'
import { brouillonsEnregistres, recuperer, synchroniser } from '../../utils/brouillonsCompteRendu'
import { periodeLongue } from '../../utils/compteRendu'
import { normaliser } from '../../utils/importEvaluation'

/**
 * Reprendre des stagiaires d'un autre compte rendu.
 *
 * Les memes techniciens reviennent d'une session a l'autre — une
 * formation puis sa certification, deux modules d'un meme parcours.
 * Retaper noms, pays et fonctions est long et source de fautes : on
 * choisit un compte rendu, on coche les stagiaires, ils rejoignent la
 * liste. Seule l'identite est reprise, jamais les notes : elles
 * appartiennent a l'autre session.
 *
 * Un stagiaire deja present — meme nom, sans egard aux accents ni a la
 * casse — est signale et ne s'ajoute pas une seconde fois.
 */
const cleDe = p => normaliser(`${p.prenom || ''} ${p.nom || ''}`)

export default function RepriseStagiaires({ brouillon, onAjouter, onFermer }) {
  const [sources, setSources] = useState(() => lister(brouillon))
  const [choisi, setChoisi] = useState(null)
  const [coches, setCoches] = useState({})

  // Les comptes rendus d'un autre poste arrivent avec la synchronisation.
  useEffect(() => {
    let actif = true
    synchroniser().then(liste => { if (actif && liste) setSources(lister(brouillon)) })
    return () => { actif = false }
  // Une fois, a l'ouverture.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const presents = new Set((brouillon.participants || []).map(cleDe).filter(Boolean))
  const stagiaires = choisi
    ? (recuperer(choisi.id)?.participants || []).filter(p => cleDe(p))
    : []

  function choisir(source) {
    setChoisi(source)
    const liste = (recuperer(source.id)?.participants || []).filter(p => cleDe(p))
    // Tous coches d'office, sauf ceux deja dans la liste.
    setCoches(Object.fromEntries(liste.map(p => [p.id, !presents.has(cleDe(p))])))
  }

  const aAjouter = stagiaires.filter(p => coches[p.id] && !presents.has(cleDe(p)))

  function ajouter() {
    onAjouter(aAjouter.map((p, i) => ({
      id: `rep-${Date.now()}-${i}`,
      prenom: p.prenom || '', nom: p.nom || '', pays: p.pays || '', fonction: p.fonction || '',
      genre: p.genre,
      present: true, entreeBrut: '', sortieTheoBrut: '', sortiePratBrut: '',
      appreciation: '', ajoute: true,
    })))
  }

  // Une fenetre au-dessus de la page : ouverte sous la liste, elle
  // prenait la place du tableau des stagiaires, qui disparaissait.
  return (
    <div className="cr-reprise-voile" onClick={e => e.target === e.currentTarget && onFermer()}>
    <div className="cr-reprise" role="dialog" aria-modal="true"
      aria-label="Reprendre des stagiaires d’un autre compte rendu">
      <div className="cr-reprise-tete">
        <p className="cr-reprise-titre">
          {choisi ? `Cochez les stagiaires à reprendre de « ${choisi.session || 'Saisie libre'} ».`
            : 'Choisissez le compte rendu où figurent vos stagiaires.'}
        </p>
        <button type="button" className="cr-import-fermer" aria-label="Fermer" onClick={onFermer}>×</button>
      </div>

      {!choisi && (sources.length ? (
        <ul className="cr-reprise-sources">
          {sources.map(s => (
            <li key={s.id}>
              <button type="button" className="cr-reprise-source" onClick={() => choisir(s)}>
                <span className="cr-reprise-source-titre">
                  {s.code && <span className="cr-session-code">{s.code}</span>}
                  {s.session || 'Saisie libre'}
                </span>
                <span className="cr-reprise-source-meta">
                  {[periodeLongue(s.debut, s.fin), `${s.nombre} stagiaire${s.nombre > 1 ? 's' : ''}`]
                    .filter(Boolean).join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="cr-vide-texte">Aucun autre compte rendu avec des stagiaires pour l’instant.</p>
      ))}

      {choisi && (
        <>
          <ul className="cr-reprise-stagiaires">
            {stagiaires.map(p => {
              const deja = presents.has(cleDe(p))
              return (
                <li key={p.id}>
                  <label className={`cr-reprise-stagiaire${deja ? ' cr-reprise-stagiaire--deja' : ''}`}>
                    <input type="checkbox" disabled={deja} checked={!deja && !!coches[p.id]}
                      onChange={e => setCoches(c => ({ ...c, [p.id]: e.target.checked }))} />
                    <span className="cr-name">{p.prenom} {p.nom}</span>
                    <span className="cr-doux">{[p.pays, p.fonction].filter(Boolean).join(' · ')}</span>
                    {deja && <span className="cr-badge cr-badge--muted">Déjà dans la liste</span>}
                  </label>
                </li>
              )
            })}
          </ul>
          <div className="cr-reprise-actions">
            <button type="button" className="cr-btn cr-btn--ghost cr-btn--petit"
              onClick={() => setChoisi(null)}>
              ← Autre compte rendu
            </button>
            <button type="button" className="cr-btn cr-btn--primary cr-btn--petit"
              disabled={!aAjouter.length} onClick={ajouter}>
              {aAjouter.length
                ? `Ajouter ${aAjouter.length} stagiaire${aAjouter.length > 1 ? 's' : ''}`
                : 'Cochez au moins un stagiaire'}
            </button>
          </div>
        </>
      )}
    </div>
    </div>
  )
}

/** Les autres comptes rendus qui ont des stagiaires nommes, du plus recent au plus ancien. */
function lister(brouillon) {
  return brouillonsEnregistres()
    .filter(s => s.id !== brouillon.sessionId)
    .map(s => ({
      ...s,
      nombre: (recuperer(s.id)?.participants || []).filter(p => cleDe(p)).length,
    }))
    .filter(s => s.nombre > 0)
}
