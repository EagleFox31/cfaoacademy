import { Navigate, useLocation } from 'react-router-dom'

/**
 * Garde des pages protégées : renvoie vers la connexion en emportant la page
 * demandée. Après la connexion, l'utilisateur revient sur cette page (lien
 * profond) au lieu de l'accueil de son portail.
 */
export default function VersConnexion() {
  const location = useLocation()
  return <Navigate to="/login" replace state={{ from: location }} />
}
