import { createContext, useContext, useEffect, useState } from 'react'

/**
 * État d'enregistrement partagé entre la page qui sauvegarde et le bandeau.
 *
 * La grille d'une marque défile sur une trentaine de lignes : un témoin posé
 * dans la page sort du champ de vision dès les premières saisies, et celui qui
 * remplit ne sait plus si son travail part bien. Dans le bandeau collant, il
 * reste sous les yeux pendant toute la saisie.
 */
const SaveStatusContext = createContext(null)

export function SaveStatusProvider({ children }) {
  const [state, setState] = useState('idle')

  return (
    <SaveStatusContext.Provider value={{ state, setState }}>
      {children}
    </SaveStatusContext.Provider>
  )
}

/** Lecture — le bandeau. */
export function useSaveStatus() {
  return useContext(SaveStatusContext)?.state ?? 'idle'
}

/** Écriture — la page de saisie. Quitter la page éteint le témoin. */
export function useReportSaveStatus(state) {
  const setState = useContext(SaveStatusContext)?.setState

  useEffect(() => {
    setState?.(state)
  }, [setState, state])

  useEffect(() => () => setState?.('idle'), [setState])
}
