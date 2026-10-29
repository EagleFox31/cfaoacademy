import { useEffect, useRef, useState } from 'react'
import '../styles/annonce-maintenance.css'
import { changementsVisibles } from '../utils/changementsMaintenance'

const SOURCE = '/maintenance.json'
const DUREE = 10
const DEJA_VUES = 'cfao.maintenances-vues'
const CLOSES = 'cfao.maintenances-closes'

/**
 * Enregistre tout de suite le travail en cours.
 *
 * L'assistant de compte rendu enregistre son brouillon a `beforeunload`,
 * et les envois au serveur en attente partent a `pagehide` : les
 * declencher revient a dire « la page va s'arreter, mettez tout a
 * l'abri » — sans que ces ecrans aient a connaitre la maintenance.
 */
function toutEnregistrer() {
  window.dispatchEvent(new Event('beforeunload'))
  window.dispatchEvent(new Event('pagehide'))
}

function liste(cle) {
  try { return JSON.parse(sessionStorage.getItem(cle) || '[]') } catch { return [] }
}

function ajouter(cle, id) {
  try { sessionStorage.setItem(cle, JSON.stringify([...liste(cle), id])) } catch { /* rien */ }
}

/**
 * Annonce d'une mise a jour, sur tous les postes ouverts.
 *
 * L'administrateur ecrit `public/maintenance.json`
 * ({ id, etat, message, changements }) :
 * - `compte`   : compte a rebours de 10 s ; le travail est enregistre des
 *                le debut, puis a 3 s pour les dernieres frappes, et la
 *                saisie est bloquee jusqu'a la fin ;
 * - `terminee` : la mise a jour est faite, on reprend ou l'on en etait ;
 *                `message`, s'il est donne, dit ce qu'elle apporte, et
 *                `changements` la liste de ses nouveautes, chacune pour
 *                tous ou pour certains roles seulement (`pour`) : chacun
 *                ne voit que celles qui le concernent.
 * Une annonce deja vue dans cet onglet ne rejoue pas apres rechargement.
 * Mais la mise a jour elle-meme peut recharger la page : l'onglet qui
 * a vu le compte a rebours retrouve alors l'annonce ou elle en etait
 * (en cours, puis terminee) jusqu'a ce que le message de fin s'efface.
 */
export default function AnnonceMaintenance({ roles }) {
  const [annonce, setAnnonce] = useState(null) // { id, reste, phase }
  const courante = useRef(null)

  useEffect(() => {
    let actif = true
    async function lire() {
      try {
        const r = await fetch(`${SOURCE}?t=${Date.now()}`, { cache: 'no-store' })
        if (!r.ok) return
        const m = await r.json()
        if (!actif || !m?.id) return
        const vue = liste(DEJA_VUES).includes(m.id)
        const suivie = courante.current === m.id
          || (vue && !courante.current && !liste(CLOSES).includes(m.id))
        if (m.etat === 'compte' && !courante.current && !vue) {
          courante.current = m.id
          ajouter(DEJA_VUES, m.id)
          toutEnregistrer()
          setAnnonce({ id: m.id, reste: DUREE, phase: 'compte' })
        } else if (m.etat === 'compte' && suivie && !courante.current) {
          // Page rechargee par la mise a jour : elle n'est pas finie.
          courante.current = m.id
          setAnnonce({ id: m.id, reste: 0, phase: 'en_cours' })
        } else if (m.etat === 'terminee' && suivie) {
          courante.current = m.id
          // Une seule fois : chaque lecture relancerait le delai d'effacement.
          setAnnonce(a => (a?.phase === 'terminee' ? a
            : { id: m.id, reste: 0, phase: 'terminee', message: m.message, changements: m.changements }))
        }
      } catch { /* serveur en redemarrage : on reessaie */ }
    }
    lire()
    const minuteur = setInterval(lire, 2000)
    return () => { actif = false; clearInterval(minuteur) }
  }, [])

  // Le compte a rebours, seconde par seconde.
  useEffect(() => {
    if (annonce?.phase !== 'compte') return undefined
    if (annonce.reste === 3) toutEnregistrer()
    if (annonce.reste <= 0) {
      setAnnonce(a => ({ ...a, phase: 'en_cours' }))
      return undefined
    }
    const t = setTimeout(() => setAnnonce(a => ({ ...a, reste: a.reste - 1 })), 1000)
    return () => clearTimeout(t)
  }, [annonce])

  const nouveautes = changementsVisibles(annonce?.changements, roles)

  // Termine : le message reste quelques secondes, puis s'efface ; une liste
  // de nouveautes attend d'avoir ete lue (bouton « Compris »).
  useEffect(() => {
    if (annonce?.phase !== 'terminee' || nouveautes.length) return undefined
    const t = setTimeout(fermer, 8000)
    return () => clearTimeout(t)
  }, [annonce?.phase, nouveautes.length])

  function fermer() {
    if (courante.current) ajouter(CLOSES, courante.current)
    courante.current = null
    setAnnonce(null)
  }

  if (!annonce) return null
  const { phase, reste, message } = annonce
  return (
    <div className="maj-voile" role="alertdialog" aria-live="assertive" aria-labelledby="maj-titre">
      <div className="maj-carte">
        {phase === 'compte' && (
          <>
            <p className="maj-surtitre">Mise à jour de l’application</p>
            <div className="maj-compte" aria-hidden="true">{reste}</div>
            <h2 id="maj-titre">Votre travail est en cours d’enregistrement</h2>
            <p>La mise à jour commence dans {reste} seconde{reste > 1 ? 's' : ''}. Vous reprendrez ensuite exactement où vous en êtes.</p>
            <div className="maj-barre"><i style={{ width: `${((DUREE - reste) / DUREE) * 100}%` }} /></div>
          </>
        )}
        {phase === 'en_cours' && (
          <>
            <p className="maj-surtitre">Mise à jour de l’application</p>
            <div className="maj-roue" aria-hidden="true" />
            <h2 id="maj-titre">Mise à jour en cours…</h2>
            <p>Votre travail est enregistré. Ne fermez pas cette page : elle reprend d’elle-même dans quelques secondes.</p>
          </>
        )}
        {phase === 'terminee' && (
          <>
            <p className="maj-surtitre">Mise à jour de l’application</p>
            <div className="maj-ok" aria-hidden="true">✓</div>
            <h2 id="maj-titre">Mise à jour terminée</h2>
            <p>{message || 'Vous pouvez reprendre votre travail.'}</p>
            {nouveautes.length > 0 && (
              <>
                <p className="maj-nouveautes-titre">Ce qui change pour vous</p>
                <ul className="maj-nouveautes">
                  {nouveautes.map(t => <li key={t}>{t}</li>)}
                </ul>
              </>
            )}
            <button type="button" className="maj-fermer" onClick={fermer}>Compris</button>
          </>
        )}
      </div>
    </div>
  )
}
