/**
 * L'adresse du module « Recueil des besoins » (cfao-needs), servi à part du
 * portail, fixée par VITE_NEEDS_URL. Sans elle : null, la carte qui y mène
 * s'affiche « en construction » plutôt que d'ouvrir une adresse morte.
 */
export function baseBesoins(env = import.meta.env) {
  const url = String(env?.VITE_NEEDS_URL ?? '').trim().replace(/\/+$/, '')
  return url || null
}

/** Props de PvCard vers le recueil des besoins : lien s'il existe, chantier sinon. */
export function versBesoins(enConstruction, env) {
  const url = baseBesoins(env)
  return url ? { onClick: () => window.location.assign(url) } : { enConstruction }
}
