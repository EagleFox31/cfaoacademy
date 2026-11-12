import { createContext, useContext } from 'react'

/**
 * Le contexte de l'aide vit dans son propre module, sans aucune dépendance :
 * modifier un article, une traduction ou le fournisseur ne le recrée donc pas
 * à chaud. Recréé, il laisserait le tiroir d'aide déjà affiché lire un contexte
 * que plus personne ne fournit.
 */
export const HelpContext = createContext(null)

export function useHelp() {
  const ctx = useContext(HelpContext)
  if (!ctx) {
    throw new Error('useHelp must be used within HelpProvider')
  }
  return ctx
}

export function useHelpOptional() {
  return useContext(HelpContext)
}
