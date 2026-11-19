// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCopy } from '../../i18n/index.js'
import { resolvePortalNavSections } from '../../data/index.js'

vi.mock('../../components/Nav', () => ({ default: () => null }))
vi.mock('../../components/Footer', () => ({ default: () => null }))
vi.mock('../../components/PortalDemoBar', () => ({ default: () => null }))
vi.mock('../../components/PortalStickyBar', () => ({ default: () => null }))
vi.mock('../../components/PortalHeader', () => ({ default: () => null }))
vi.mock('../../components/PortalAssistanceSection.jsx', () => ({ default: () => null }))
vi.mock('../../components/PortalReveal.jsx', () => ({
  default: ({ id, children }) => <section id={id}>{children}</section>,
}))
vi.mock('../../components/PortalStaggerGrid.jsx', () => ({ default: ({ children }) => <div>{children}</div> }))
vi.mock('../../hooks/useSiteEffects', () => ({ default: () => {} }))
vi.mock('../../hooks/usePortalBackground', () => ({ default: () => {} }))
vi.mock('../../hooks/usePortalHeaderHeight.js', () => ({ default: () => {} }))
vi.mock('../../hooks/useAjustementEcran.js', () => ({ default: () => {} }))
const USER = { id: 'f1', roles: ['trainer'], prenom: 'Test', nom: 'Formateur' }
vi.mock('../../hooks/useAuth', () => ({ default: () => ({ user: USER, status: 'ready' }) }))
const LANGUE = { code: 'fr' }
vi.mock('../../hooks/useLocale', () => ({
  default: s => ({ t: getCopy(s, LANGUE.code), locale: LANGUE.code }),
}))

const { default: TrainerHome } = await import('./TrainerHome.jsx')
globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root
async function show(code) {
  LANGUE.code = code
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => { root.render(<MemoryRouter><TrainerHome /></MemoryRouter>) })
}
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('portail du formateur', () => {
  it('chaque onglet de la navbar a sa section dans la page', async () => {
    await show('fr')
    const ancres = [...host.querySelectorAll('section[id]')].map(s => s.id)
    const onglets = resolvePortalNavSections(USER.roles, null, USER).map(s => s.id)
    expect(onglets).toEqual(expect.arrayContaining(['formations', 'competences', 'certifs']))
    expect(ancres).toEqual(onglets)
  })

  it.each(['fr', 'en', 'pt'])('sections annoncées en construction, sans lien (%s)', async code => {
    await show(code)
    const t = getCopy('trainerHome', code)
    for (const id of ['formations', 'competences', 'certifs']) {
      const section = host.querySelector(`section#${id}`)
      expect(section.querySelector('.portal-construction-media')).not.toBeNull()
      expect(section.querySelector('a')).toBeNull()
    }
    const titres = [...host.querySelectorAll('section#competences .pv-card-title, section#competences h3')]
      .map(n => n.textContent)
    for (const p of ['junior', 'senior', 'expert']) expect(titres.join(' ')).toContain(t[`results_${p}_card`])
    expect(host.textContent).not.toContain('undefined')
  })

  it('aucun texte français dans la version anglaise', async () => {
    await show('en')
    expect(host.textContent).not.toMatch(/Comptes rendus|Formations à dispenser|À suivre/)
  })
})
