/**
 * Schéma des configs de portail par rôle (docs/engineering/fabrique-portails.md).
 * Module pur : ni React, ni `data/index.js`.
 */
import { PORTAL_NS, cle } from './texte.js'

/** Les 7 étapes MEDACAP, dans l'ordre du cycle. */
export const MEDACAP_ETAPES = ['mesurer', 'exploiter', 'definir', 'acquerir', 'certifier', 'appliquer', 'performer']

export const KINDS = ['priorities', 'cards', 'construction', 'rich']

const LINK_KEYS = ['module', 'section', 'to', 'href']

/** Clés de texte portées par une section et ses cartes. */
function textRefs(config, section) {
  // La navbar lit ses libellés dans `portal`, sans préfixe.
  const refs = [section.head?.eyebrow, section.head?.title,
    section.nav && `${PORTAL_NS}:${section.nav.labelKey}`]
  if (section.kind === 'construction') {
    const c = { ...config.construction, ...section.construction }
    refs.push(c.label, c.chip)
  }
  for (const card of section.cards ?? []) {
    refs.push(card.chip?.key, card.title, card.meta, card.metaEmpty, card.cta, card.hint)
    if (card.construction) refs.push(config.construction?.label, config.construction?.chip)
  }
  return refs.filter(r => r != null)
}

const avecDetail = s => Boolean(s.visibleIf?.needsDetail || s.visibleIf?.detail === true)
const sansDetail = s => s.visibleIf?.detail === false

/**
 * Deux sections de même id ne s'affichent jamais ensemble : modes disjoints,
 * ou l'une seulement en vue détaillée et l'autre seulement sans. Une même
 * ancre peut ainsi changer de forme selon le profil (ex. résultats en vue
 * macro ou par filiale).
 */
export function exclusives(a, b) {
  const ma = a.visibleIf?.modes
  const mb = b.visibleIf?.modes
  if (ma && mb && !ma.some(m => mb.includes(m))) return true
  return (avecDetail(a) && sansDetail(b)) || (sansDetail(a) && avecDetail(b))
}

/**
 * Vérifie une config. Renvoie la liste des erreurs (vide = valide).
 * `copy(ns, locale)` (optionnel) donne le dictionnaire d'une langue : chaque
 * clé de texte doit alors exister dans chacune de `locales`.
 */
export function validateConfig(config, { copy, locales = [] } = {}) {
  const errors = []
  const err = m => errors.push(`${config?.key ?? '?'} : ${m}`)
  if (!config?.key) err('key manquante')
  if (!config?.ns) err('ns manquant')
  if (!Array.isArray(config?.sections)) { err('sections manquantes'); return errors }

  const ids = new Set()
  config.sections.forEach((s, i) => {
    if (config.sections.slice(0, i).some(x => x.id === s.id && !exclusives(x, s))) err(`section en double : ${s.id}`)
    ids.add(s.id)
    if (!KINDS.includes(s.kind)) err(`${s.id} : kind inconnu ${s.kind}`)
    if (s.etape !== null && !MEDACAP_ETAPES.includes(s.etape)) err(`${s.id} : étape inconnue ${s.etape}`)
    if (s.kind === 'rich' && !s.render) err(`${s.id} : section riche sans render`)
    if (config.observer && s.kind === 'priorities') err(`${s.id} : un observateur n'a pas de priorités`)
    const cardIds = new Set()
    for (const c of s.cards ?? []) {
      if (cardIds.has(c.id)) err(`${s.id} : carte en double ${c.id}`)
      cardIds.add(c.id)
      if (config.observer && (c.link || c.cta)) err(`${s.id}/${c.id} : un observateur n'a ni lien ni CTA`)
      if (c.construction && !config.construction) err(`${s.id}/${c.id} : carte en construction sans config.construction`)
      if (c.construction && c.link) err(`${s.id}/${c.id} : une carte en construction n'a pas de lien`)
      if (c.link && !LINK_KEYS.some(k => k in c.link)) err(`${s.id}/${c.id} : lien sans destination`)
      if (c.link?.section && !config.sections.some(x => x.id === c.link.section)) {
        err(`${s.id}/${c.id} : section cible inconnue ${c.link.section}`)
      }
    }
  })
  if (config.viewportSection && !ids.has(config.viewportSection)) {
    err(`viewportSection inconnue : ${config.viewportSection}`)
  }

  if (copy) {
    for (const s of config.sections) {
      for (const ref of textRefs(config, s)) {
        const { ns, key } = cle(ref, config.ns)
        for (const locale of locales) {
          if (copy(ns, locale)?.[key] == null) err(`${s.id} : clé ${ns}:${key} absente en ${locale}`)
        }
      }
    }
  }
  return errors
}
