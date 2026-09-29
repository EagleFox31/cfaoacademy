export const config = {
  port: Number(process.env.PORT ?? 3000),
  oidcJwksUrl: process.env.OIDC_JWKS_URL ?? '',
  oidcIssuer: process.env.OIDC_ISSUER ?? '',
  oidcAudience: process.env.OIDC_AUDIENCE || undefined,
  cerbosHttp: (process.env.CERBOS_HTTP ?? 'http://localhost:3592').replace(/\/$/, ''),
  db: {
    host: process.env.OPS_DB_HOST ?? 'localhost',
    port: Number(process.env.OPS_DB_PORT ?? 5432),
    database: process.env.OPS_DB_NAME ?? 'ops',
    user: process.env.OPS_DB_USER ?? 'ops',
    password: process.env.OPS_DB_PASSWORD ?? 'ops',
  },
}
