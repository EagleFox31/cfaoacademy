// Client Cerbos (PDP) — check via l'API HTTP. Fail-closed.
import { randomUUID } from 'node:crypto'
import { config } from '../config/index.js'
import type { Principal } from '../middleware/auth.js'

export async function check(
  principal: Principal,
  kind: string,
  resourceId: string,
  attr: Record<string, unknown>,
  action: string,
): Promise<boolean> {
  const body = {
    requestId: randomUUID(),
    principal: { id: principal.id, roles: principal.roles.length ? principal.roles : ['_anon'], attr: principal.attr },
    resources: [{ resource: { kind, id: resourceId || '_new', attr }, actions: [action] }],
  }
  try {
    const resp = await fetch(`${config.cerbosHttp}/api/check/resources`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!resp.ok) return false
    const data = (await resp.json()) as { results?: Array<{ actions?: Record<string, string> }> }
    return data.results?.[0]?.actions?.[action] === 'EFFECT_ALLOW'
  } catch {
    return false // PDP indisponible ⇒ refus
  }
}
