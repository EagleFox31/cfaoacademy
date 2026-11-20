import { useSyncExternalStore } from 'react'
import { isMaintenance, subscribeMaintenance } from '../lib/api'

/** Vrai pendant qu'un appel d'API attend la fin d'une mise à jour (503 de cfao-edge). */
export default function useMaintenance() {
  return useSyncExternalStore(subscribeMaintenance, isMaintenance, () => false)
}
