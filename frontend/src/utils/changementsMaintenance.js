/**
 * Les changements d'une mise a jour que cette personne doit voir.
 *
 * `maintenance.json` les liste ainsi : `[{ texte, pour? }]`. Sans `pour`,
 * le changement concerne tout le monde ; avec `pour: ['superadmin']`, seuls
 * ces roles le voient (un formateur n'apprend pas l'existence d'un ecran
 * qui ne lui est pas ouvert). Les entrees mal formees sont ignorees.
 */
export function changementsVisibles(changements, roles) {
  if (!Array.isArray(changements)) return []
  const siens = new Set(roles ?? [])
  return changements
    .filter(c => c && typeof c.texte === 'string' && c.texte.trim())
    .filter(c => !Array.isArray(c.pour) || c.pour.some(r => siens.has(r)))
    .map(c => c.texte.trim())
}
