/**
 * Textes des portails décrits par configuration.
 *
 * Une clé `'x'` se lit dans le namespace du profil, `'portal:x'` dans
 * `portal` (toujours chargé). Module pur : ni React, ni `data/index.js`.
 */

export const PORTAL_NS = 'portal'

/** `'portal:x'` → { ns: 'portal', key: 'x' } ; `'x'` → { ns, key: 'x' }. */
export function cle(ref, ns) {
  const i = ref.indexOf(':')
  return i < 0 ? { ns, key: ref } : { ns: ref.slice(0, i), key: ref.slice(i + 1) }
}

/** Texte traduit : remplace les {variables} et prend `cle_one` quand n <= 1
 * (même convention que les sections DPS et RHHome). */
export function tx(t, key, vars = {}) {
  const modele = (vars.n != null && vars.n <= 1 && t[`${key}_one`]) || t[key] || ''
  return Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v ?? '—'), modele)
}

/**
 * Lecteur de textes d'un portail : `texte('x')` ou `texte('portal:x')`.
 * Une clé absente rend `undefined`, comme `t.x` dans les pages écrites à la
 * main (`validateConfig` garantit qu'elle existe dans chaque langue).
 */
export function lecteur(ns, t, tPortal) {
  const dicos = { [ns]: t, [PORTAL_NS]: tPortal }
  return ref => {
    if (ref == null) return undefined
    const { ns: n, key } = cle(ref, ns)
    return dicos[n]?.[key]
  }
}
