/** Retire le préfixe marque des titres FAD quand le contexte hero l’a déjà établi. */
export function compactInstructorSessionTitle(title, brandLabel) {
  if (!title?.trim() || !brandLabel) return title
  const escaped = brandLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return title.replace(new RegExp(`^${escaped}\\s+`, 'i'), '').trim()
}

/** Titre + lieu sans redondance (ville entre parenthèses si `lieu` est affiché à part). */
export function formatKiSessionDisplayTitle(fad, brandLabel) {
  let title = compactInstructorSessionTitle(fad?.title, brandLabel)
  if (fad?.lieu) {
    title = title.replace(/\s*\([^)]+\)\s*$/, '').trim()
  }
  return title
}

export function isKiSessionDatePending(fad) {
  return fad?.statut === 'attente' || /^en attente$/i.test(String(fad?.date ?? '').trim())
}
