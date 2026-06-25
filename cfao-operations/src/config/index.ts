export const config = {
  port: Number(process.env.PORT ?? 3000),
  oidcJwksUrl: process.env.OIDC_JWKS_URL ?? '',
  oidcIssuer: process.env.OIDC_ISSUER ?? '',
  oidcAudience: process.env.OIDC_AUDIENCE || undefined,
  cerbosHttp: (process.env.CERBOS_HTTP ?? 'http://localhost:3592').replace(/\/$/, ''),
}
