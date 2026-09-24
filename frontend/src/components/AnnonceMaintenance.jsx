import { useEffect, useRef, useState } from 'react'
import '../styles/annonce-maintenance.css'

const SOURCE = '/maintenance.json'
const DUREE = 10
const DEJA_VUES = 'cfao.maintenances-vues'

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

function vues() {
  try { return JSON.parse(sessionStorage.getItem(DEJA_VUES) || '[]') } catch { return [] }
}

/**
 * Annonce d'une mise a jour, sur tous les postes ouverts.
 *
 * L'administrateur ecrit `public/maintenance.json` ({ id, etat }) :
 * - `compte`   : compte a rebours de 10 s ; le travail est enregistre des
 *                le debut, puis a 3 s pour les dernieres frappes, et la
 *                saisie est bloquee jusqu'a la fin ;
 * - `terminee` : la mise a jour est faite, on reprend ou l'on en etait.
 * Une annonce deja vue dans cet onglet ne rejoue pas apres rechargement.
 */
export default function AnnonceMaintenance() {
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
        const deja = vues()
        if (m.etat === 'compte' && !courante.current && !deja.includes(m.id)) {
          courante.current = m.id
          try { sessionStorage.setItem(DEJA_VUES, JSON.stringify([...deja, m.id])) } catch { /* rien */ }
          toutEnregistrer()
          setAnnonce({ id: m.id, reste: DUREE, phase: 'compte' })
        } else if (m.etat === 'terminee' && courante.current === m.id) {
          // Une seule fois : chaque lecture relancerait le delai d'effacement.
          setAnnonce(a => (a && a.phase !== 'terminee' ? { ...a, phase: 'terminee' } : a))
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

  // Termine : le message reste quelques secondes, puis s'efface.
  useEffect(() => {
    if (annonce?.phase !== 'terminee') return undefined
    const t = setTimeout(() => { courante.current = null; setAnnonce(null) }, 4000)
    return () => clearTimeout(t)
  }, [annonce?.phase])

  if (!annonce) return null
  const { phase, reste } = annonce
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
            <p>Vous pouvez reprendre votre travail.</p>
          </>
        )}
      </div>
    </div>
  )
}
