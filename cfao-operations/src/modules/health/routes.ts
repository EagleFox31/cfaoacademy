import { Router } from 'express'

export const healthRouter = Router()

// Public — sonde de vie (pas d'auth).
healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'cfao-operations' })
})
