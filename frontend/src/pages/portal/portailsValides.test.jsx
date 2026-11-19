// @vitest-environment jsdom
// Portails dont la structure et les libellés sont validés par le métier
// (registre : docs/engineering/fabrique-portails.md, « Portails validés »).
// Ce test fige, pour chacun et dans les 3 langues, le titre d'accueil puis
// chaque section dans l'ordre : ancre, surtitre, titre. Un libellé validé qui
// change fait échouer le test : mettre à jour la capture (-u) seulement si le
// changement a été validé, et le noter dans le registre.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { getCopy } from '../../i18n/index.js'
import profils from '../../data/mock_profiles.json'

vi.mock('../../components/Nav', () => ({ default: () => null }))
vi.mock('../../components/Footer', () => ({ default: () => null }))
vi.mock('../../components/PortalDemoBar', () => ({ default: () => null }))
vi.mock('../../components/PortalStickyBar', () => ({ default: () => null }))
vi.mock('../../components/PortalStickyBar.jsx', () => ({ default: () => null }))
vi.mock('../../components/PortalReveal.jsx', () => ({
  default: ({ id, children }) => <section id={id}>{children}</section>,
}))
vi.mock('../../components/PortalStaggerGrid.jsx', () => ({ default: ({ children }) => <div>{children}</div> }))
vi.mock('../../hooks/useSiteEffects', () => ({ default: () => {} }))
vi.mock('../../hooks/usePortalReveal', () => ({ default: () => {} }))
vi.mock('../../hooks/usePortalBackground', () => ({ default: () => {} }))
vi.mock('../../hooks/usePortalHeaderHeight.js', () => ({ default: () => {} }))
vi.mock('../../hooks/useAjustementEcran.js', () => ({ default: () => {} }))
const ETAT = { user: null, code: 'fr' }
vi.mock('../../hooks/useAuth', () => ({ default: () => ({ user: ETAT.user, status: 'ready' }) }))
vi.mock('../../hooks/useLocale', () => ({
  default: s => ({ t: getCopy(s, ETAT.code), locale: ETAT.code }),
}))

const { default: CenterHome } = await import('./CenterHome.jsx')
const { default: DpsDashboard } = await import('./DpsDashboard.jsx')
const { default: TrainerHome } = await import('./TrainerHome.jsx')
const { default: RHHome } = await import('./RHHome.jsx')
globalThis.IS_REACT_ACT_ENVIRONMENT = true

// Comme AuthContext : l'utilisateur de démo porte demoKey = id du profil.
const profil = id => {
  const p = profils.find(x => x.id === id)
  return p && { ...p, demoKey: p.id }
}
const PORTAILS = [
  { nom: 'directeur du centre de formation', user: { id: 'cd1', roles: ['center_director'], firstName: 'Test', lastName: 'Directeur' }, page: <CenterHome /> },
  { nom: 'DPS', user: profil('u10'), page: <DpsDashboard /> },
  { nom: 'formateur', user: { id: 'f1', roles: ['trainer'], firstName: 'Test', lastName: 'Formateur' }, page: <TrainerHome /> },
  { nom: 'RH filiale', user: profil('u5'), page: <RHHome mode="branch_hr" /> },
]

// Réseau coupé : seul le code du dépôt décide de la structure figée.
beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-01T09:00:00'))
  vi.stubGlobal('fetch', () => Promise.reject(new Error('hors ligne')))
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
  const Observateur = class { observe() {} unobserve() {} disconnect() {} }
  vi.stubGlobal('IntersectionObserver', Observateur)
  vi.stubGlobal('ResizeObserver', Observateur)
})
afterAll(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

let host, root
afterEach(() => {
  if (root) act(() => root.unmount())
  host?.remove()
  root = host = null
})

const texte = el => el?.textContent.replace(/\s+/g, ' ').trim() || null

async function structure({ user, page }, code) {
  Object.assign(ETAT, { user, code })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => { root.render(<MemoryRouter initialEntries={['/portail']}>{page}</MemoryRouter>) })
  await act(async () => { await new Promise(r => setTimeout(r, 0)) })
  return {
    accueil: texte(host.querySelector('h1')),
    sections: [...host.querySelectorAll('section[id]')].map(s => ({
      ancre: s.id,
      surtitre: texte(s.querySelector('[class*="eyebrow"]')),
      titre: texte(s.querySelector('h2')),
    })),
  }
}

describe('portails validés : sections et libellés figés', () => {
  it('les comptes de démo existent', () => {
    expect(profil('u10')?.roles).toContain('dps')
    expect(profil('u5')?.roles).toContain('branch_hr')
  })

  for (const portail of PORTAILS) {
    it.each(['fr', 'en', 'pt'])(`${portail.nom} (%s)`, async code => {
      const rendu = await structure(portail, code)
      expect(rendu.sections.length).toBeGreaterThan(0)
      expect(rendu).toMatchSnapshot()
    })
  }
})
