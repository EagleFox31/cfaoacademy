/**
 * API du module cfao-supervision (lecture seule). Même jeton et même gestion
 * 401/403 que le client du portail (lib/api.js).
 */
import { createClient } from './api'

const BASE = import.meta.env.VITE_SUPERVISION_API_URL || '/api/v1/supervision'
const http = createClient(BASE)

const project = name => encodeURIComponent(name)

export const supervisionApi = {
  /** `{ board, connections }` : ce que le compte connecté peut voir. */
  access: () => http.get('/access'),
  /** État de chaque module, chiffres du haut et fraîcheur de la collecte. */
  overview: () => http.get('/overview'),
  /** Qui fournit quelle API à qui, et si les versions s'accordent. */
  dependencies: () => http.get('/dependencies'),
  /** Dernières connexions par compte et par module. */
  connections: () => http.get('/connections'),
  module: name => http.get(`/modules/${project(name)}`),
  history: name => http.get(`/modules/${project(name)}/history`),
}
