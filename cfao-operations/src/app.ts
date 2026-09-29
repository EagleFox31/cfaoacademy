// L'application Express, sans ecoute : `server.ts` la demarre, les tests l'appellent.
import express, { type NextFunction, type Request, type Response } from 'express'
import { healthRouter } from './modules/health/routes.js'
import { reportsRouter } from './modules/reports/routes.js'
import { requireAuth } from './middleware/auth.js'
import { requireCerbos } from './middleware/authz.js'

export const app = express()
// Un brouillon de rapport (notes, avis, textes) depasse la limite par defaut de 100 ko.
app.use(express.json({ limit: '2mb' }))

// En-têtes de sécurité de base.
app.disable('x-powered-by')

const api = express.Router()
api.use(healthRouter)
api.use(reportsRouter)

// Exemple de route protégée de référence (patron à recopier pour les modules) :
// JWT Keycloak → principal → Cerbos check (kind session, action view).
api.get(
  '/me',
  requireAuth,
  requireCerbos('account', 'view:self', (req) => ({
    id: req.principal!.id,
    attr: { orgPath: req.principal!.attr.orgPath },
  })),
  (req, res) => {
    res.json(req.principal)
  },
)

app.use('/api/v1/ops', api)

// Erreurs non prevues : format normalise (architecture.md §5.1), sans detail interne.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // eslint-disable-next-line no-console
  console.error(err)
  res.status(500).json({ error: { code: 'internal', message: 'Erreur interne' } })
})
