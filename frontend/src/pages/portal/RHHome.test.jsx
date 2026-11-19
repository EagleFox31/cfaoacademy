// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCopy } from '../../i18n/index.js'
import { resolvePortalNavSections } from '../../data/index.js'
import { PLANNING_HOME } from '../../utils/planningAccess.js'
import { codeFiliale, filiales, syntheseCompetences, synthesePersonnes } from '../../utils/rhDonnees'
import { PIF_YEARS } from '../../utils/learnerPif.js'
import { resolvePortalOrientKey } from '../../utils/portalOrient.js'
import { CONSULTATION_MODES } from './portalProfiles.js'
import { CLE_REPARTITION } from './roleportal/configs/consultation.js'

vi.mock('../../components/Nav', () => ({ default: () => null }))
vi.mock('../../components/Footer', () => ({ default: () => null }))
vi.mock('../../components/PortalDemoBar', () => ({ default: () => null }))
vi.mock('../../components/PortalStickyBar', () => ({ default: () => null }))
const HEADER = { props: null }
vi.mock('../../components/PortalHeader', () => ({ default: p => { HEADER.props = p; return null } }))
vi.mock('../../components/PortalReveal.jsx', () => ({
  default: ({ id, children }) => <section id={id}>{children}</section>,
}))
vi.mock('../../components/PortalStaggerGrid.jsx', () => ({ default: ({ children }) => <div>{children}</div> }))
vi.mock('../../hooks/useSiteEffects', () => ({ default: () => {} }))
vi.mock('../../hooks/usePortalBackground', () => ({ default: () => {} }))
vi.mock('../../hooks/usePortalHeaderHeight.js', () => ({ default: () => {} }))
vi.mock('../../hooks/useAjustementEcran.js', () => ({ default: () => {} }))
const AUTH = { user: null }
vi.mock('../../hooks/useAuth', () => ({ default: () => ({ user: AUTH.user, status: 'ready' }) }))
vi.mock('../../hooks/useLocale', () => ({ default: s => ({ t: getCopy(s, 'fr'), locale: 'fr' }) }))

const { default: RHHome } = await import('./RHHome.jsx')
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const t = getCopy('consultation', 'fr')

let host, root
async function show(role, pays = filiales()[0].pays) {
  AUTH.user = { id: 'u1', roles: [role], pays }
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => { root.render(<MemoryRouter><RHHome mode={role} /></MemoryRouter>) })
}
afterEach(() => {
  if (!root) return
  act(() => root.unmount()); host.remove(); root = null
})

const ancres = () => [...host.querySelectorAll('section[id]')].map(s => s.id)
const texteDe = id => host.querySelector(`section#${id}`).textContent

describe('portail de consultation (fabrique)', () => {
  it('chaque profil a sa propre phrase sous le bonjour, dans les 3 langues', () => {
    const roles = Object.keys(CONSULTATION_MODES)
    for (const cles of [roles.map(resolvePortalOrientKey), roles.map(r => `consult_hero_${r}`)]) {
      expect(new Set(cles).size).toBe(cles.length)
      for (const locale of ['fr', 'en', 'pt']) {
        const p = getCopy('portal', locale)
        cles.forEach(k => expect(p[k], `${locale}:${k}`).toBeTruthy())
      }
    }
  })

  it('RH filiale : grande phrase chiffrée du métier, filiale dans le titre (norme DPS)', async () => {
    await show('branch_hr')
    const p = getCopy('portal', 'fr')
    const { statsHero } = HEADER.props
    const { techniciens } = synthesePersonnes({ filiale: codeFiliale(AUTH.user.pays), bu: null })
    expect(statsHero.gabarit).toBe(p.consult_hero_branch_hr)
    expect(statsHero.gabarit).toContain('{marques}')
    expect(statsHero.filiale).toBe(true)
    // Marques : MEDACAP seulement, jamais le jeu de démo → inconnu ici, « — » à l'écran.
    expect(statsHero.chiffres).toMatchObject({ techs: techniciens, marques: null, marques_mot: p.consult_hero_brands })
  })

  it('directeur groupe : chiffres du groupe ; directeur régional : phrase sans chiffre inventé', async () => {
    await show('group_director')
    expect(HEADER.props.statsHero.chiffres.filiales).toBe(syntheseCompetences().parFiliale.length)
    act(() => root.unmount()); host.remove()
    await show('regional_director')
    expect(HEADER.props.statsHero.gabarit).toBe(getCopy('portal', 'fr').consult_hero_regional_director)
    expect(HEADER.props.statsHero.chiffres).toEqual({})
  })

  it.each(Object.keys(CONSULTATION_MODES))('%s : chaque onglet de la navbar a sa section, dans le même ordre', async role => {
    await show(role)
    const onglets = resolvePortalNavSections([role], null, AUTH.user).map(s => s.id)
    const enPlus = CONSULTATION_MODES[role].sections.includes('a-traiter') ? ['a-traiter'] : []
    expect(ancres()).toEqual([...enPlus, ...onglets])
    expect(onglets).toEqual(CONSULTATION_MODES[role].sections.filter(id => id !== 'a-traiter'))
  })

  it('RH filiale sans filiale connue : rien du jeu RH, résultats et PIF en construction', async () => {
    await show('branch_hr', 'Atlantide')
    expect(ancres()).toEqual(['competences', 'pif', 'besoins'])
    expect(texteDe('competences')).toContain(t.results_meta_filiale)
    expect(texteDe('competences')).toContain(t.under_construction)
  })

  it('directeur régional : vue macro et clé de répartition à sa portée', async () => {
    await show('regional_director')
    expect(texteDe('competences')).toContain(t.results_eyebrow_region)
    expect(texteDe('pif')).toContain(t.pif_meta_region)
    expect(texteDe('cle')).toContain(t.cle_meta_region)
    expect(texteDe('cle')).not.toContain(t.cle_meta_groupe)
  })

  it('RH filiale : résultats par niveau de sa filiale, chiffres MEDACAP, sans filtre inactif', async () => {
    await show('branch_hr')
    const filiale = codeFiliale(AUTH.user.pays)
    expect(host.querySelector('#a-traiter select')).toBeNull()
    expect(texteDe('competences')).toContain(t.comp_title_filiale)
    const cartes = [...host.querySelectorAll('#competences .pv-card')]
    expect(cartes.map(c => c.textContent)).toEqual([
      expect.stringContaining(t.level_maintenance),
      expect.stringContaining(t.level_repair),
      expect.stringContaining(t.level_diagnostic),
    ])
    // Vraie donnée : pas de chantier sur ces cartes, chiffres de la filiale.
    expect(host.querySelectorAll('#competences .pv-card--en-construction')).toHaveLength(0)
    const { parNiveau } = syntheseCompetences({ filiale, bu: null })
    parNiveau.forEach((n, i) => expect(cartes[i].textContent).toContain(`${n.evalues}/${n.techniciens}`))
  })

  it('RH filiale : PIF pluriannuel chiffré, années en construction faute de donnée', async () => {
    await show('branch_hr')
    expect(texteDe('pif')).toContain(t.pif_filiale_title)
    const cartes = [...host.querySelectorAll('#pif .pv-card')]
    expect(cartes).toHaveLength(1 + PIF_YEARS.length)
    expect(cartes[0].textContent).toContain(t.pif_pluri_title)
    expect(cartes[0].classList.contains('pv-card--en-construction')).toBe(false)
    cartes.slice(1).forEach((c, i) => {
      expect(c.textContent).toContain(String(PIF_YEARS[i]))
      expect(c.classList.contains('pv-card--en-construction')).toBe(true)
    })
  })

  it('besoins : une carte par campagne annuelle, toutes en construction', async () => {
    await show('branch_hr')
    const an = new Date().getFullYear()
    expect(texteDe('besoins')).toContain(t.needs_title)
    const cartes = [...host.querySelectorAll('#besoins .pv-card')]
    expect(cartes.map(c => c.textContent)).toEqual([an + 1, an, an - 1].map(a => expect.stringContaining(String(a))))
    cartes.forEach(c => expect(c.classList.contains('pv-card--en-construction')).toBe(true))
  })

  it('RH groupe : une carte par filiale pour les résultats', async () => {
    await show('group_hr')
    expect(texteDe('competences')).toContain(t.comp_title)
    expect(host.querySelectorAll('#competences .portal-card-anchor').length)
      .toBe(syntheseCompetences().parFiliale.length)
  })

  it('la clé de répartition ouvre l\'écran du planning par un vrai lien', async () => {
    expect(CLE_REPARTITION).toBe(PLANNING_HOME)
    await show('group_admin')
    expect(host.querySelector(`#cle a[href="${PLANNING_HOME}"]`)).not.toBeNull()
    expect(texteDe('cle')).toContain(t.cle_meta_groupe)
  })
})
