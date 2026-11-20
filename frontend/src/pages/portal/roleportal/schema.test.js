import { describe, expect, it } from 'vitest'
import { MEDACAP_ETAPES, validateConfig } from './schema.js'
import { navFromConfig } from './visibility.js'
import { tx } from './texte.js'

const BASE = {
  key: 'demo', ns: 'demo', viewportSection: 'a',
  sections: [
    { id: 'a', kind: 'priorities', etape: null, head: { eyebrow: 'portal:eb', title: 'ti' },
      nav: { labelKey: 'nav_a' },
      cards: [{ id: 'c', title: 'ti', cta: 'ti', link: { section: 'b' } }] },
    { id: 'b', kind: 'cards', etape: 'acquerir', nav: { labelKey: 'nav_b', iconKey: 'award' },
      visibleIf: { roles: ['superadmin'] }, cards: [] },
  ],
}

describe('validateConfig', () => {
  it('config valide : aucune erreur', () => {
    expect(validateConfig(BASE)).toEqual([])
    expect(MEDACAP_ETAPES).toHaveLength(7)
  })

  it('ids en double, étape et kind inconnus, cible absente', () => {
    const errs = validateConfig({ ...BASE, sections: [
      { ...BASE.sections[0], cards: [{ id: 'c', link: { section: 'zz' } }, { id: 'c' }] },
      { id: 'a', kind: 'tableau', etape: 'inventer' },
      { id: 'r', kind: 'rich', etape: null },
    ] })
    expect(errs.join('\n')).toMatch(/section en double : a/)
    expect(errs.join('\n')).toMatch(/kind inconnu tableau/)
    expect(errs.join('\n')).toMatch(/étape inconnue inventer/)
    expect(errs.join('\n')).toMatch(/section cible inconnue zz/)
    expect(errs.join('\n')).toMatch(/carte en double c/)
    expect(errs.join('\n')).toMatch(/riche sans render/)
  })

  it('même id permis seulement pour des sections exclusives (modes ou vue détaillée)', () => {
    const s = (visibleIf) => ({ id: 'x', kind: 'cards', etape: null, visibleIf })
    const errs = sections => validateConfig({ key: 'k', ns: 'k', sections })
    expect(errs([s({ modes: ['a'] }), s({ modes: ['b'] })])).toEqual([])
    expect(errs([s({ detail: false }), s({ needsDetail: true })])).toEqual([])
    expect(errs([s({ modes: ['a'] }), s({ modes: ['a', 'b'] })]).join('\n')).toMatch(/section en double : x/)
  })

  it('observateur : refuse les priorités, les liens et les CTA', () => {
    const errs = validateConfig({ ...BASE, observer: true })
    expect(errs.join('\n')).toMatch(/observateur n'a pas de priorités/)
    expect(errs.join('\n')).toMatch(/ni lien ni CTA/)
  })

  it('clé de texte absente dans une langue', () => {
    const dicos = { demo: { ti: 'T' }, portal: { eb: 'E', nav_a: 'A', nav_b: 'B' } }
    const copy = (ns, locale) => (locale === 'fr' ? dicos[ns] : { ...dicos[ns], ti: undefined })
    expect(validateConfig(BASE, { copy, locales: ['fr'] })).toEqual([])
    expect(validateConfig(BASE, { copy, locales: ['fr', 'en'] }).join('\n')).toMatch(/demo:ti absente en en/)
  })

  it('chiffres du hero : cible = ancre de la page, _one et _zero sauf pour un taux', () => {
    const avecCarte = { ...BASE, sections: [BASE.sections[0],
      { ...BASE.sections[1], cards: [{ id: 'k', ancre: true }] }] }
    const kpis = heroKpis => ({ ...avecCarte, heroKpis })
    const ok = { a: [{ id: 'n', label: 'k_n', cible: 'a' }], b: [{ id: 'p', label: 'k_p', cible: 'b-k', format: 'pct' }] }
    expect(validateConfig(kpis(ok))).toEqual([])
    expect(validateConfig(kpis([{ id: 'n', label: 'k_n', cible: 'zz', format: 'ratio' }])).join('\n'))
      .toMatch(/cible inconnue zz[\s\S]*format inconnu ratio/)

    const dicos = { demo: { ti: 'T', k_n: 'N', k_n_one: 'N1', k_p: 'P' }, portal: { eb: 'E', nav_a: 'A', nav_b: 'B' } }
    const copy = ns => dicos[ns]
    const errs = validateConfig(kpis(ok), { copy, locales: ['fr'] }).join('\n')
    expect(errs).toMatch(/demo:k_n_zero absente en fr/)
    expect(errs).not.toMatch(/k_p_/)
  })
})

describe('navFromConfig', () => {
  it('onglets des sections visibles, iconKey seulement si déclarée', () => {
    const env = roles => ({ ctx: { roles } })
    expect(navFromConfig(BASE, env([]))).toEqual([{ key: 'a', id: 'a', labelKey: 'nav_a' }])
    expect(navFromConfig(BASE, env(['superadmin']))[1]).toEqual({ key: 'b', id: 'b', labelKey: 'nav_b', iconKey: 'award' })
  })

  it('vue détaillée : detail false et needsDetail se partagent une ancre', () => {
    const config = { sections: [
      { id: 'x', nav: { labelKey: 'n' }, visibleIf: { detail: false }, head: { title: 'macro' } },
      { id: 'x', nav: { labelKey: 'n' }, visibleIf: { needsDetail: true }, head: { title: 'detail' } },
    ] }
    expect(navFromConfig(config)).toHaveLength(1)
    expect(navFromConfig(config, { detail: false })).toHaveLength(1)
    expect(navFromConfig(config, { detail: true })).toHaveLength(1)
  })
})

describe('tx', () => {
  it('variables et singulier _one', () => {
    const t = { n: '{n} sessions', n_one: '{n} session' }
    expect(tx(t, 'n', { n: 1 })).toBe('1 session')
    expect(tx(t, 'n', { n: 3 })).toBe('3 sessions')
  })
})
