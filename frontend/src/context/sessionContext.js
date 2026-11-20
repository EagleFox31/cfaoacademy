import { createContext } from 'react'

/**
 * Le contexte de session vit dans son propre module, sans aucune dépendance :
 * modifier le fournisseur ou ses données ne le recrée donc pas à chaud.
 */
export const AuthContext = createContext(null)
