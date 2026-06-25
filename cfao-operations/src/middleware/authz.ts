// PEP : exige une décision ALLOW de Cerbos. Default-deny.
import type { NextFunction, Request, Response } from 'express'
import { check } from '../lib/cerbos.js'

type Target = (req: Request) => { id: string; attr: Record<string, unknown> }

export function requireCerbos(kind: string, action: string, target?: Target) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.principal) {
      return res.status(401).json({ error: { code: 'unauthenticated', message: 'Auth requise' } })
    }
    const { id, attr } = target ? target(req) : { id: '*', attr: {} }
    const allowed = await check(req.principal, kind, id, attr, action)
    if (!allowed) {
      return res.status(403).json({ error: { code: 'forbidden', message: 'Action non autorisée' } })
    }
    next()
  }
}
