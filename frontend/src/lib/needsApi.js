/**
 * API du module cfao-needs (recueil des besoins). Même jeton et même gestion
 * 401/403 que le client du portail (lib/api.js).
 */
import { createClient } from './api'

const BASE = import.meta.env.VITE_NEEDS_API_URL || '/api/v1/needs'
const http = createClient(BASE)

export const needsApi = {
  /** Campagnes de recueil, paginées : `{ next, previous, results: [{ id, year, label, status, opens_at, closes_at }] }`. */
  campaigns: () => http.get('/campaigns'),
}
