import express from 'express'
import { config } from './config/index.js'
import { healthRouter } from './modules/health/routes.js'
import { requireAuth } from './middleware/auth.js'
import { requireCerbos } from './middleware/authz.js'

const app = express()
app.use(express.json())

// En-têtes de sécurité de base.
app.disable('x-powered-by')

// Journal d'accès sur la sortie standard, lu par `docker logs`.
// Chemin sans la chaîne de requête : rien de sensible dans le journal.
app.use((req, res, next) => {
  const debut = process.hrtime.bigint()
  const chemin = req.path
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - debut) / 1e6
    // eslint-disable-next-line no-console
    console.log(`${req.ip} "${req.method} ${chemin}" ${res.statusCode} ${ms.toFixed(1)}ms`)
  })
  next()
})

const api = express.Router()
api.use(healthRouter)

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

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`cfao-operations en écoute sur :${config.port}`)
})
