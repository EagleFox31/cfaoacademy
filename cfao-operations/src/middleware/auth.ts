// Valide le JWT Keycloak via JWKS (même contrat que cfao-core).
import type { NextFunction, Request, Response } from 'express'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { config } from '../config/index.js'

export interface Principal {
  id: string
  roles: string[]
  attr: {
    scopeNode: string
    // MULTI-SCOPE, comme cfao-core : les roles derives Cerbos lisent `scopeNodes`.
    scopeNodes: string[]
    departments: string[]
    brands: string[]
    orgPath: string[]
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      principal?: Principal
    }
  }
}

const jwks = config.oidcJwksUrl ? createRemoteJWKSet(new URL(config.oidcJwksUrl)) : null

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? ''
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: { code: 'unauthenticated', message: 'Jeton manquant' } })
  }
  if (!jwks) {
    return res.status(500).json({ error: { code: 'misconfigured', message: 'OIDC_JWKS_URL absent' } })
  }
  try {
    const { payload } = await jwtVerify(header.slice(7), jwks, {
      issuer: config.oidcIssuer || undefined,
      audience: config.oidcAudience,
    })
    const roles = ((payload.realm_access as { roles?: string[] } | undefined)?.roles) ?? []
    const scopeNode = (payload.scopeNode as string) ?? ''
    req.principal = {
      id: String(payload.sub),
      roles,
      attr: {
        scopeNode,
        scopeNodes: scopeNode ? [scopeNode] : [],
        departments: (payload.departments as string[]) ?? [],
        brands: (payload.brands as string[]) ?? [],
        orgPath: (payload.orgPath as string[]) ?? [],
      },
    }
    next()
  } catch (err) {
    return res.status(401).json({ error: { code: 'invalid_token', message: String(err) } })
  }
}
