/**
 * Matrice « qui voit quoi » des portails : lignes = sections (et leurs cartes)
 * groupées par étape MEDACAP, colonnes = profils.
 *
 * États d'une case :
 *  - `shown`       : affichée ;
 *  - `conditional` : affichée seulement quand il y a des données ;
 *  - `locked`      : interdite à ce profil (`reason` dit pourquoi) ;
 *  - `absent`      : ce portail n'a pas cette section ;
 *  - `na`          : ce portail n'est pas encore décrit par la fabrique.
 *
 * Lecture seule : les défauts restent dans les configs (code).
 * Module pur : ni React, ni `data/index.js`.
 */
import { MEDACAP_ETAPES } from './schema.js'

const HORS_ETAPE = 'autre'

/** Pourquoi un nœud est interdit à un profil (null = rien ne l'interdit). */
export function lockReason(node, profile, config) {
  const roles = node?.visibleIf?.roles
  if (roles && !roles.includes(profile)) return 'role'
  // Portail partagé par plusieurs rôles : le mode est le rôle.
  const modes = node?.visibleIf?.modes
  if (modes && !modes.includes(profile)) return 'role'
  if (config?.observer && (node?.link || node?.cta || node?.kind === 'priorities')) return 'observer'
  return null
}

function cellFor(node, profile, config) {
  if (!config) return { state: 'na' }
  if (!node) return { state: 'absent' }
  const reason = lockReason(node, profile, config)
  if (reason) return { state: 'locked', reason }
  if (node.visibleIf?.selector) return { state: 'conditional' }
  return { state: 'shown' }
}

/**
 * @param configs  { [profil]: config } (configs de la fabrique)
 * @param profiles profils en colonnes, dans l'ordre voulu
 * @returns [{ etape, rows: [{ nodeId, level, ns, labelKey, cells: { [profil]: { state, reason? } } }] }]
 */
export function portalMatrix(configs = {}, profiles = []) {
  const rows = new Map()
  const add = (nodeId, level, etape, ns, labelKey) => {
    if (!rows.has(nodeId)) rows.set(nodeId, { nodeId, level, etape, ns, labelKey })
  }
  for (const config of Object.values(configs)) {
    for (const s of config.sections ?? []) {
      const etape = MEDACAP_ETAPES.includes(s.etape) ? s.etape : HORS_ETAPE
      add(s.id, 0, etape, config.ns, s.head?.title ?? null)
      for (const c of s.cards ?? []) add(`${s.id}/${c.id}`, 1, etape, config.ns, c.title ?? null)
    }
  }

  const findNode = (config, nodeId, profile) => {
    if (!config) return null
    const [sid, cid] = nodeId.split('/')
    // Une ancre déclinée en sections exclusives : celle qui vaut pour ce profil.
    const candidates = config.sections?.filter(s => s.id === sid) ?? []
    const section = candidates.find(s => !s.visibleIf?.modes || s.visibleIf.modes.includes(profile)) ?? candidates[0]
    if (!section || !cid) return section ?? null
    const card = section.cards?.find(c => c.id === cid)
    // Une carte hérite des conditions de sa section.
    return card ? { ...card, visibleIf: card.visibleIf ?? section.visibleIf } : null
  }

  const ordre = [...MEDACAP_ETAPES, HORS_ETAPE]
  return ordre
    .map(etape => ({
      etape,
      rows: [...rows.values()]
        .filter(r => r.etape === etape)
        .map(r => ({
          nodeId: r.nodeId, level: r.level, ns: r.ns, labelKey: r.labelKey,
          cells: Object.fromEntries(profiles.map(p => [p, cellFor(findNode(configs[p], r.nodeId, p), p, configs[p])])),
        })),
    }))
    .filter(g => g.rows.length > 0)
}

/** Profils dont le portail est décrit par la fabrique. */
export function profilesInFactory(configs = {}, profiles = []) {
  return profiles.filter(p => configs[p])
}
