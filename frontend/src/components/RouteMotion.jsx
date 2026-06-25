import { useLocation } from 'react-router-dom'

/**
 * Transition de page « morph » : crossfade + léger scale/translate rejoué
 * à chaque changement de route (clé = pathname). Effet proche de la
 * View Transitions API mais fiable sur tous les navigateurs, sans overlay.
 * Désactivé si prefers-reduced-motion (géré en CSS).
 */
export default function RouteMotion({ children }) {
  const { pathname } = useLocation()
  return (
    <div key={pathname} className="route-motion">
      {children}
    </div>
  )
}
