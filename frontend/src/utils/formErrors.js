/** Helpers partagés pour la validation et l’affichage des erreurs de formulaire. */

export function isValidEmail(value) {
  const email = value?.trim() ?? ''
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/** Connexion : e-mail ou nom d'utilisateur (sans @). */
export function isValidLoginIdentifier(value) {
  const id = value?.trim() ?? ''
  if (!id) return false
  if (id.includes('@')) return isValidEmail(id)
  return id.length >= 3
}

export function resolveFormMessage(messages, code) {
  if (!code) return null
  return messages[code] ?? messages.GENERIC ?? 'Une erreur est survenue.'
}

export function hasFieldErrors(fieldErrors = {}) {
  return Object.keys(fieldErrors).length > 0
}
