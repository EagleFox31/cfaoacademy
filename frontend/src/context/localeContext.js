import { createContext, useContext } from 'react'

/**
 * Le contexte de langue vit dans son propre module, sans aucune dépendance :
 * modifier une traduction ne le recrée donc pas à chaud. Recréé, il laisserait
 * les écrans déjà affichés lire un contexte que plus personne ne fournit.
 */
export const LocaleContext = createContext(null)

export function useLocaleContext() {
  const ctx = useContext(LocaleContext)
  if (!ctx) {
    throw new Error('useLocaleContext must be used within LocaleProvider')
  }
  return ctx
}
