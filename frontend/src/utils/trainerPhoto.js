import equipe from '../data/academy/equipe-poles.json'

const tokens = name => new Set(
  String(name || '').normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().split(/[^A-Z]+/).filter(Boolean),
)

const TEAM = equipe.poles.flatMap(p => p.members).filter(m => m.photo)
  .map(m => ({ tokens: tokens(m.name), photo: m.photo }))

/** Même personne malgré l'ordre ou un nom complet : au moins deux mots, tous présents dans l'autre nom. */
function samePerson(a, b) {
  const [short, long] = a.size <= b.size ? [a, b] : [b, a]
  return short.size >= 2 && [...short].every(word => long.has(word))
}

/** Une cellule peut citer plusieurs formateurs. */
export const splitTrainers = value => String(value || '').split(/[,/&+]/).map(s => s.trim()).filter(Boolean)

/** Photo de la page Équipe, ou null si la personne n'y figure pas. */
export function trainerPhoto(name) {
  const wanted = tokens(name)
  return TEAM.find(member => samePerson(wanted, member.tokens))?.photo ?? null
}

export function trainerInitials(name) {
  return [...tokens(name)].slice(0, 2).map(word => word[0]).join('')
}
