/**
 * Types de proposition de modification d'un portail. Le serveur stocke le code
 * d'un type de la liste, ou le texte libre saisi par l'auteur (60 caractères).
 * Libellés et exemples : portal.json, clés proposition_type_<code> et
 * proposition_exemple_<code>.
 */
/** Événement de fenêtre émis après l'envoi d'une proposition (rafraîchit « Mes propositions »). */
export const PROPOSITION_CREEE = 'cfao-proposition-creee'

export const TYPES_PROPOSITION = [
  'texte',
  'info_manquante',
  'recalcul',
  'ordre',
  'couleur',
  'agrandir',
  'image',
  'ajout_section',
  'retrait_section',
  'ajout_vignette',
  'ajout_kpi',
  'ajout_fonctionnalite',
]

export const TYPE_MAX = 60

const normal = s => String(s ?? '').replace(/\s+/g, ' ').trim()

/** Libellé affiché : celui du type de la liste, sinon le texte libre tel quel. */
export function libelleType(type, t) {
  return TYPES_PROPOSITION.includes(type) ? (t[`proposition_type_${type}`] ?? type) : normal(type)
}

/** Ce qu'on envoie : le code si la saisie est un libellé de la liste, sinon le texte libre. */
export function typeDepuisSaisie(saisie, t) {
  const texte = normal(saisie).slice(0, TYPE_MAX)
  const cle = texte.toLocaleLowerCase()
  return TYPES_PROPOSITION.find(c => normal(t[`proposition_type_${c}`]).toLocaleLowerCase() === cle) ?? texte
}

/** Types libres déjà utilisés par l'auteur, à reproposer dans la liste (sans doublon). */
export function typesLibres(propositions = []) {
  const vus = new Map()
  for (const p of propositions ?? []) {
    const type = normal(p?.type)
    if (type && !TYPES_PROPOSITION.includes(type) && !vus.has(type.toLocaleLowerCase())) {
      vus.set(type.toLocaleLowerCase(), type)
    }
  }
  return [...vus.values()]
}
