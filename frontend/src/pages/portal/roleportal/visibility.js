/**
 * Visibilité des sections et des cartes d'un portail, et navbar dérivée.
 *
 * La page et la navbar passent par le même prédicat : elles ne peuvent plus
 * diverger. Module pur : ni React, ni `data/index.js`.
 *
 * `env` = { ctx: { user, roles, lms }, selectors, mode, detail }
 *  - `selectors` : fonctions synchrones `(ctx) => valeur` du profil ;
 *  - `mode` / `detail` : mode de consultation (périmètre) et vue détaillée.
 */

/** Un nœud (section ou carte) est-il visible dans cet environnement ? */
export function isVisible(node, env = {}) {
  const cond = node?.visibleIf
  if (!cond) return true
  const roles = env.ctx?.roles ?? []
  if (cond.roles && !cond.roles.some(r => roles.includes(r))) return false
  if (cond.modes && !cond.modes.includes(env.mode)) return false
  if ((cond.needsDetail || cond.detail === true) && !env.detail) return false
  if (cond.detail === false && env.detail) return false
  if (cond.selector) {
    const selector = env.selectors?.[cond.selector]
    if (typeof selector !== 'function') throw new Error(`Sélecteur inconnu : ${cond.selector}`)
    if (!selector(env.ctx ?? {})) return false
  }
  return true
}

/** Sections visibles d'un profil, dans l'ordre de la config. */
export function visibleSections(config, env) {
  return config.sections.filter(s => isVisible(s, env))
}

/** Onglets de navbar d'un profil : sections visibles qui déclarent `nav`.
 * Sans `env`, tous les onglets possibles du profil (liste statique). */
export function navFromConfig(config, env) {
  // Sans env, une ancre déclinée en plusieurs sections exclusives ne compte qu'une fois.
  return (env ? visibleSections(config, env) : config.sections)
    .filter((s, i, liste) => s.nav && liste.findIndex(x => x.id === s.id) === i)
    .map(({ id, nav }) => ({
      key: id, id, labelKey: nav.labelKey,
      ...(nav.iconKey ? { iconKey: nav.iconKey } : {}),
    }))
}
