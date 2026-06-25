import { getCopy } from '../i18n/index.js'
import { localizedCountryName } from './localizeGeo.js'
import { countryCodeFromName } from './countryFlag.js'

export function localizeAcademyPillar(pillar, locale = 'fr') {
  if (!pillar || locale === 'fr') return pillar
  const patch = getCopy('academyPanels', locale)[pillar.id]
  if (!patch) return pillar
  return {
    ...pillar,
    ...patch,
    steps: patch.steps ?? pillar.steps,
    paragraphs: patch.paragraphs ?? pillar.paragraphs,
  }
}

export function localizeEquipePole(pole, locale = 'fr') {
  if (!pole || locale === 'fr') return pole
  const patch = getCopy('equipePoles', locale)[pole.id]
  if (!patch) return pole
  return { ...pole, ...patch }
}

export function localizeTeamMember(person, locale = 'fr') {
  if (!person || locale === 'fr') return person
  const patch = getCopy('equipeMembers', locale)[person.name]
  return {
    ...person,
    role: patch?.role ?? person.role,
    note: patch?.note ?? person.note,
    lieuLabel: localizedCountryName(
      person.lieu,
      locale,
      countryCodeFromName(person.lieu),
    ),
  }
}

export function localizeCartographieRegion(region, locale = 'fr') {
  if (!region || locale === 'fr') return region
  const patch = getCopy('regions', locale)[region.id]
  if (!patch) return region
  return {
    ...region,
    label: patch.label ?? region.label,
    shortLabel: patch.shortLabel ?? region.shortLabel,
    countries: region.countries.map((c) => ({
      ...c,
      displayName: localizedCountryName(
        c.name,
        locale,
        countryCodeFromName(c.name),
      ),
    })),
  }
}

export function localizeCartographieRegions(regions, locale = 'fr') {
  if (locale === 'fr') return regions
  return regions.map((r) => localizeCartographieRegion(r, locale))
}
