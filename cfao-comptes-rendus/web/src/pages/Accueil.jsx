import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import useEnHautDePage from '../hooks/useEnHautDePage'
import { useAuth } from '../lib/auth'
import { sessionsDuFormateur } from '../data/mock_sessions_formateur'
import { aDocumenter } from '../utils/planningFormateur.js'
import {
  brouillonsEnregistres, brouillonsTermines, synchroniser,
} from '../utils/brouillonsCompteRendu'

/** « il y a 2 jours », pour situer une reprise sans afficher une date brute. */
function venuDe(iso) {
  const jours = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (jours <= 0) return "aujourd'hui"
  if (jours === 1) return 'hier'
  if (jours < 14) return `il y a ${jours} jours`
  return `il y a ${Math.round(jours / 7)} semaines`
}

/**
 * L'accueil du module : trois entrées, toujours présentes — commencer,
 * reprendre, retrouver. Les sessions à documenter se choisissent à
 * l'ouverture d'un nouveau compte rendu.
 */
export default function Accueil() {
  useEnHautDePage('Accueil')
  const { user } = useAuth()
  const naviguer = useNavigate()
  const sessions = useMemo(() => sessionsDuFormateur(user), [user])

  // Ceux de ce navigateur tout de suite, puis ceux du service — saisis
  // sur un autre poste — dès qu'il répond.
  const [brouillons, setBrouillons] = useState(() => brouillonsEnregistres())
  useEffect(() => {
    let actif = true
    synchroniser().then(liste => { if (actif && liste) setBrouillons(liste) })
    return () => { actif = false }
  }, [])

  const termines = brouillonsTermines(brouillons)
  const { aContinuer: enCours, aCommencer } = aDocumenter(sessions, brouillons)

  const cartes = [
    {
      id: 'nouveau',
      pastille: `${aCommencer.length} à rédiger`,
      ton: aCommencer.length ? 'progress' : 'done',
      titre: 'Nouveau compte rendu',
      texte: 'Depuis une session de formation planifiée, ou en saisissant tout manuellement.',
      action: 'Commencer',
      vers: '/portail/compte-rendu/nouveau',
      principale: true,
    },
    {
      id: 'en-cours',
      pastille: `${enCours.length} en cours`,
      ton: 'todo',
      titre: 'Comptes rendus en cours',
      texte: enCours.length
        ? `Reprendre ou supprimer une saisie commencée — la dernière ${venuDe(enCours[0].modifieLe)}.`
        : 'Les saisies commencées s’y retrouvent, sur tout poste.',
      action: 'Voir les saisies',
      vers: '/portail/compte-rendu/en-cours',
    },
    {
      id: 'rapports',
      pastille: termines.length > 0
        ? `${termines.length} rapport${termines.length > 1 ? 's' : ''}`
        : 'Archive',
      ton: 'done',
      titre: 'Mes comptes rendus',
      texte: termines.length
        ? `Les comptes rendus terminés — le dernier ${venuDe(termines[0].termineLe)}.`
        : 'Les comptes rendus terminés s’y rangent.',
      action: 'Ouvrir l’archive',
      vers: '/portail/compte-rendu/mes-rapports',
    },
  ]

  return (
    <main className="accueil">
      <div className="container">
        <p className="accueil-surtitre">Vos documents</p>
        <h1 className="accueil-titre">Comptes rendus</h1>
        <div className="accueil-grille">
          {cartes.map(c => (
            <button key={c.id} type="button"
              className={`accueil-carte${c.principale ? ' accueil-carte--principale' : ''}`}
              onClick={() => naviguer(c.vers)}>
              <span className={`accueil-pastille ${c.ton}`}>{c.pastille}</span>
              <span className="accueil-carte-titre">{c.titre}</span>
              <span className="accueil-carte-texte">{c.texte}</span>
              <span className="accueil-carte-action">{c.action} →</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
