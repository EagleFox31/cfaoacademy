import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'

/**
 * Hook — journal d'audit cfao-core, transformé pour `DpsActivitySection`.
 *
 * L'API renvoie des `AuditEvent` bruts :
 *   { id, created_at, actor_sub, actor_roles, action, resource_kind,
 *     resource_id, org_path, metadata }
 *
 * On adapte vers le shape attendu par le composant activité DPS :
 *   { time, type, summary, brandLogo?, score? }
 *
 * `type` est dérivé de `resource_kind` (grouping visuel dans DpsActivitySection).
 * `summary` est reconstruit lisible : « <actor> — <action> <ressource> ».
 *
 * Fail-open : erreur réseau ou 403 → renvoie tableau vide, le hero ne casse pas.
 * Accessible aux rôles groupe (superadmin, group_admin, ...).
 */

/**
 * Groupement audit → type d'événement pour DpsActivitySection.
 * Aligne les couleurs / icônes avec ce que fait déjà le composant.
 */
function typeFromResource(resourceKind, action) {
  const k = String(resourceKind ?? '').toLowerCase()
  const a = String(action ?? '').toLowerCase()
  if (k.includes('role_assignment') || k.includes('user_account')) return 'pif'
  if (k.includes('evaluation') || a.includes('assessment'))         return 'test'
  if (k.includes('enrollment')  || k.includes('session'))           return 'session'
  if (a.includes('alert') || a.includes('warn'))                     return 'alert'
  return 'other'
}

function shortActorSub(sub) {
  return String(sub ?? '').slice(0, 8) || '—'
}

function humanizeAction(action) {
  // assignment.create → Assignment created
  const parts = String(action ?? '').split('.')
  if (parts.length !== 2) return action || ''
  const [what, verb] = parts
  return `${what} ${verb}d`
}

function adaptAuditEvent(ev) {
  const at = ev.created_at ? new Date(ev.created_at) : new Date()
  // Format « HH:MM » du jour, sinon date courte (jour/mois) — miroir des logs
  // MEDACAP DPS qui affichent souvent l'heure.
  const now = new Date()
  const sameDay = at.toDateString() === now.toDateString()
  const time = sameDay
    ? at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : at.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })

  const actor = shortActorSub(ev.actor_sub)
  const target = ev.metadata?.target ? ` sur ${shortActorSub(ev.metadata.target)}` : ''
  const summary = `${actor} — ${humanizeAction(ev.action)}${target}`

  return {
    id:      ev.id,
    time,
    type:    typeFromResource(ev.resource_kind, ev.action),
    summary,
    brandLogo: null,
    score: null,
  }
}

export default function useAuditLogs(user) {
  const isGroupScope = Array.isArray(user?.roles) && (
    user.roles.includes('superadmin') ||
    user.roles.includes('group_admin') ||
    user.roles.includes('group_hr')
  )
  const [logs, setLogs] = useState(null)
  const [loading, setLoading] = useState(isGroupScope)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isGroupScope) {
      setLogs(null)
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    api.auditLogs()
      .then(payload => {
        if (cancelled) return
        const rows = Array.isArray(payload?.results) ? payload.results : []
        setLogs(rows.map(adaptAuditEvent))
        setLoading(false)
      })
      .catch(e => {
        if (cancelled) return
        setError(e instanceof ApiError ? { status: e.status, message: e.message } : { message: String(e) })
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [isGroupScope, user?.sub])

  return { logs, loading, error }
}
