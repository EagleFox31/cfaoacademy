import { Suspense, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import PortalLoader from './PortalLoader.jsx'
import RepliChargement from './RepliChargement.jsx'
import useLocale from '../hooks/useLocale.js'

/** Routes dont la page est elle-même un loader plein écran (pas de double intro). */
const SKIP_ROUTE_LOADER = new Set(['/portail/medacap-launch'])

/**
 * Écrans applicatifs : passer d'une vue à l'autre (sous-chemin) reste dans l'app,
 * sans loader plein écran ni remontage. L'app anime elle-même ses vues.
 */
export const APP_SCOPES = ['/portail/cle-repartition']

/** Clé de transition : le préfixe d'app si le chemin en relève, sinon le chemin. */
export function routeScope(pathname) {
  return APP_SCOPES.find(p => pathname === p || pathname.startsWith(`${p}/`)) ?? pathname
}

function getRouteLoaderTiming() {
  const reduce = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const hold = reduce ? 150 : 850
  return { hold, done: hold + 450 }
}

/**
 * Transition globale App : PortalLoader à chaque changement de route
 * (landing ↔ login, portail, formations…). Crossfade contenu via `.route-motion`.
 */
export default function RouteMotion({ children }) {
  const { pathname: rawPath } = useLocation()
  const pathname = routeScope(rawPath)
  const { t } = useLocale('common')
  const skipFirst = useRef(true)
  const [phase, setPhase] = useState('done')

  useEffect(() => {
    if (SKIP_ROUTE_LOADER.has(pathname)) {
      setPhase('done')
      skipFirst.current = false
      return undefined
    }

    if (skipFirst.current) {
      skipFirst.current = false
      setPhase('done')
      return undefined
    }

    setPhase('loading')
    const { hold, done } = getRouteLoaderTiming()
    const t1 = window.setTimeout(() => setPhase('leaving'), hold)
    const t2 = window.setTimeout(() => setPhase('done'), done)

    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [pathname])

  const messages = [t.routeLoaderMsg1, t.routeLoaderMsg2, t.routeLoaderMsg3]
  const contentVisible = phase === 'leaving' || phase === 'done'

  return (
    <>
      {phase !== 'done' && (
        <PortalLoader
          leaving={phase === 'leaving'}
          messages={messages}
          ariaLabel={t.routeLoaderAria}
        />
      )}
      <div
        key={pathname}
        className={`route-motion${contentVisible ? ' route-motion--ready' : ' route-motion--pending'}`}
        aria-hidden={!contentVisible}
      >
        <RepliChargement>
          {/* Pendant la transition, le loader de route couvre déjà l'écran. */}
          <Suspense fallback={phase === 'done' ? <PortalLoader messages={messages} ariaLabel={t.routeLoaderAria} /> : null}>
            {children}
          </Suspense>
        </RepliChargement>
      </div>
    </>
  )
}
