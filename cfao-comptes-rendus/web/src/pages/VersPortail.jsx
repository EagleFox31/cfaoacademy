import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { BASE } from '../lib/adresse'
import { adressePortail } from '../lib/portail'

/** Écran de repli sans portail (module servi seul) : la liste à documenter. */
const REPLI = '/portail/compte-rendu/a-documenter'
const MARQUE = 'cr-vers-portail'
const DELAI_MS = 10000

/**
 * Faut-il quitter le module pour la cible ? Non si elle mène dans le module
 * lui-même (même origine, sous BASE) : la redirection reviendrait ici sans fin.
 */
export function quitteLeModule(cible, base = BASE, origine = window.location.origin) {
  if (!cible) return false
  try {
    const url = new URL(cible, origine)
    return !(url.origin === origine && url.pathname.startsWith(base))
  } catch {
    return false
  }
}

/** Une seule redirection vers le portail par fenêtre de 10 s : coupe toute boucle. */
function dejaRedirige(maintenant = Date.now()) {
  try {
    const t = Number(window.sessionStorage.getItem(MARQUE))
    if (t && maintenant - t < DELAI_MS) return true
    window.sessionStorage.setItem(MARQUE, String(maintenant))
  } catch {
    /* stockage indisponible : on se fie au seul test d'adresse */
  }
  return false
}

/**
 * Racine du module : l'accueil formateur est celui du portail, on y renvoie
 * (avec l'ancre demandée). Sans portail, ou si la cible ramène dans le module
 * ou boucle, on ouvre la liste à documenter.
 */
export default function VersPortail() {
  const { hash } = useLocation()
  const cible = adressePortail(hash)
  const sortir = quitteLeModule(cible)

  // Garde déjà jouée (le portail ramène ici) : on ouvre le repli, jamais d'écran vide.
  const [repli, setRepli] = useState(false)

  useEffect(() => {
    if (!sortir) return
    if (dejaRedirige()) setRepli(true)
    else window.location.replace(cible)
  }, [sortir, cible])

  return !sortir || repli ? <Navigate to={REPLI} replace /> : null
}
