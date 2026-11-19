/**
 * Supervision : accès, menu et règles d'affichage des états.
 *
 * Les états viennent de l'API (cfao-supervision/api/supervision/status.py) :
 * ok, done, starting, degraded, crashloop, down. Ici, seulement leur couleur,
 * leur ordre et leurs regroupements. Module pur : ni React, ni appel réseau.
 * La garde par rôle n'est que de l'ergonomie : Cerbos décide côté serveur.
 */

const SUPERVISION_ROLES = new Set(['platform_ops', 'superadmin'])

export function canSeeSupervision(roles = []) {
  return (roles ?? []).some(r => SUPERVISION_ROLES.has(r))
}

export const SUPERVISION_HOME = 'overview'

/** Entrées du menu ; `connections` n'apparaît qu'avec ce droit. */
export const SUPERVISION_NAV = [
  { id: 'overview', ico: '◧' },
  { id: 'dependencies', ico: '⇄' },
  { id: 'connections', ico: '◉', needs: 'connections' },
]

export const SUPERVISION_VIEWS = SUPERVISION_NAV.map(v => v.id)

export function supervisionPath(view = SUPERVISION_HOME) {
  return view === SUPERVISION_HOME ? '/portail/supervision' : `/portail/supervision/${view}`
}

export function modulePath(project) {
  return `/portail/supervision/modules/${encodeURIComponent(project)}`
}

/** Du pire au meilleur : l'ordre d'affichage des modules. */
export const STATUS_ORDER = ['down', 'crashloop', 'degraded', 'starting', 'ok', 'done']

const TONE = {
  ok: 'done', done: 'done', starting: 'in_progress', degraded: 'warn', crashloop: 'blocked', down: 'blocked',
}

/** Classe `dlv-status` de l'état ; un état inconnu reste neutre. */
export function statusTone(status) {
  return TONE[status] ?? 'todo'
}

const rank = status => {
  const i = STATUS_ORDER.indexOf(status)
  return i === -1 ? 0 : i
}

/** Modules en panne d'abord, puis par nom. */
export function sortModules(modules = []) {
  return [...modules].sort((a, b) => rank(a.status) - rank(b.status)
    || String(a.name ?? a.project).localeCompare(String(b.name ?? b.project)))
}

/** Les trois chiffres du haut : en ligne, à surveiller, en panne. */
export function summarize(counts = {}) {
  const n = key => Number(counts[key] ?? 0)
  return {
    up: n('ok') + n('done'),
    watch: n('starting') + n('degraded'),
    down: n('crashloop') + n('down'),
  }
}

const UNITS = [
  ['year', 365 * 86400], ['month', 30 * 86400], ['week', 7 * 86400],
  ['day', 86400], ['hour', 3600], ['minute', 60],
]

/** « il y a 3 minutes », « hier »… ; null si la date manque ou est illisible. */
export function relativeTime(iso, locale = 'fr', now = Date.now()) {
  const at = iso ? Date.parse(iso) : NaN
  if (Number.isNaN(at)) return null
  const seconds = Math.round((at - now) / 1000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit)
  }
  return rtf.format(0, 'minute')
}

/** « {n} conteneurs » + { n: 3 } -> « 3 conteneurs » ; une variable absente reste visible. */
export function fill(text, vars = {}) {
  return String(text ?? '').replace(/\{(\w+)\}/g, (all, key) => (vars[key] ?? all))
}

/** Date et heure complètes, pour l'infobulle et les tableaux. */
export function absoluteTime(iso, locale = 'fr') {
  const at = iso ? new Date(iso) : null
  if (!at || Number.isNaN(at.getTime())) return null
  return at.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })
}
