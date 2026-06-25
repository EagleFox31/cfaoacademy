const modules = import.meta.glob('./*.json', { eager: true })

const ORDER = ['medacap', 'mission', 'equipe', 'reseau', 'pays']

export const ACADEMY_PILLARS = Object.entries(modules)
  .filter(([path]) => !path.includes('_schema') && !path.includes('equipe-poles') && !path.includes('pays-cartographie'))
  .map(([, mod]) => mod.default ?? mod)
  .sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id))

/** Compatibilité cartes (kicker, title, meta, tab) — titre carte = panelTitle si défini. */
export const ACADEMY_PREVIEW = ACADEMY_PILLARS.map(({ tab, kicker, title, meta, image, panelTitle }) => ({
  tab,
  kicker,
  title: panelTitle ?? title,
  meta,
  image,
}))

export function getAcademyPillar(id) {
  return ACADEMY_PILLARS.find((p) => p.id === id)
}
