// Story 04-5.2 : brouillons des rapports formateur, sous /api/v1/ops/reports.
//
// Chaque route suit le patron du service : JWT Keycloak (requireAuth), puis
// decision Cerbos sur la ressource `trainer_report` (policy
// cerbos/policies/resource_policies/trainer_report.yaml). Les listes passent par
// le query plan, traduit en SQL : aucun filtrage d'autorisation a la main.
import { Router, type NextFunction, type Request, type Response } from 'express'
import { requireAuth, type Principal } from '../../middleware/auth.js'
import { check, plan } from '../../lib/cerbos.js'
import { clauseDuPlan, PlanNonTraduisible, type Clause } from '../../lib/plan.js'
import * as repo from './repo.js'

export const KIND = 'trainer_report'
const IDENT = /^[A-Za-z0-9._-]{1,80}$/

// Express 4 ne rattrape pas les rejets des routes asynchrones : on les confie au
// gestionnaire d'erreurs du service.
const asynchrone = (f: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => { f(req, res).catch(next) }

export const reportsRouter = Router()
reportsRouter.use('/reports', requireAuth)

const erreur = (res: Response, statut: number, code: string, message: string) =>
  res.status(statut).json({ error: { code, message } })

const attributs = (b: { ownerId: string; orgPath: string[] }) => ({ ownerId: b.ownerId, orgPath: b.orgPath })

const autorise = (p: Principal, id: string, b: { ownerId: string; orgPath: string[] }, action: string) =>
  check(p, KIND, id, attributs(b), action)

/**
 * Les brouillons visibles. Par defaut ceux du connecte (`portee=miens`), que
 * l'assistant synchronise ; `portee=tous` donne tout le perimetre autorise
 * (supervision du directeur de centre).
 */
reportsRouter.get('/reports/drafts', asynchrone(async (req: Request, res: Response) => {
  const p = req.principal!
  let visibles: Clause
  try {
    visibles = clauseDuPlan(await plan(p, KIND, 'view'), repo.COLONNES)
  } catch (e) {
    if (e instanceof PlanNonTraduisible) visibles = { sql: 'FALSE', values: [] }
    else throw e
  }
  const tous = req.query.portee === 'tous'
  const liste = await repo.lister(visibles, tous ? undefined : p.id)
  res.json({
    brouillons: liste.map(b => (tous ? { ...b.contenu, _proprietaire: b.ownerId } : b.contenu)),
    supprimes: await repo.suppressions(p.id),
  })
}))

/** Un brouillon ; celui d'un autre proprietaire avec `?proprietaire=`. */
reportsRouter.get('/reports/drafts/:id', asynchrone(async (req: Request, res: Response) => {
  const p = req.principal!
  const proprietaire = typeof req.query.proprietaire === 'string' ? req.query.proprietaire : p.id
  if (!IDENT.test(req.params.id)) return erreur(res, 400, 'invalid_id', 'Identifiant invalide')
  const b = await repo.lire(proprietaire, req.params.id)
  if (!b) return erreur(res, 404, 'not_found', 'Brouillon introuvable')
  if (!(await autorise(p, b.id, b, 'view'))) return erreur(res, 403, 'forbidden', 'Action non autorisée')
  res.json(b.contenu)
}))

reportsRouter.put('/reports/drafts/:id', asynchrone(async (req: Request, res: Response) => {
  const p = req.principal!
  const corps = req.body
  if (!IDENT.test(req.params.id) || !corps || typeof corps !== 'object' || Array.isArray(corps)) {
    return erreur(res, 400, 'invalid_request', 'Requête invalide')
  }
  const existant = await repo.lire(p.id, req.params.id)
  const cible = existant ?? { ownerId: p.id, orgPath: p.attr.orgPath }
  if (!(await autorise(p, req.params.id, cible, existant ? 'update' : 'create'))) {
    return erreur(res, 403, 'forbidden', 'Action non autorisée')
  }
  const { garde, ecrit } = await repo.ecrire(p.id, cible.orgPath, req.params.id, corps)
  res.json({ ecrit, brouillon: garde })
}))

reportsRouter.delete('/reports/drafts/:id', asynchrone(async (req: Request, res: Response) => {
  const p = req.principal!
  if (!IDENT.test(req.params.id)) return erreur(res, 400, 'invalid_id', 'Identifiant invalide')
  const existant = await repo.lire(p.id, req.params.id)
  const cible = existant ?? { ownerId: p.id, orgPath: p.attr.orgPath }
  if (!(await autorise(p, req.params.id, cible, 'delete'))) {
    return erreur(res, 403, 'forbidden', 'Action non autorisée')
  }
  await repo.supprimer(p.id, req.params.id)
  res.json({ supprime: true })
}))
