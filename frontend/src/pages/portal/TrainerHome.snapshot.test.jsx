// @vitest-environment jsdom
// Caractérisation du portail formateur avant la fabrique de portails
// (docs/engineering/fabrique-portails.md, étape 0) : le rendu doit rester
// identique octet pour octet quand TrainerHome passera par RolePortal.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { getCopy } from '../../i18n/index.js'

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
const SANS_SESSION = { id: 'f1', roles: ['trainer'], firstName: 'Test', lastName: 'Formateur' }
const AVEC_SESSIONS = { id: 'f2', roles: ['trainer'], firstName: 'Eugène', lastName: 'EBENE' }
const ETAT = { user: SANS_SESSION, code: 'fr' }
vi.mock('../../hooks/useAuth', () => ({ default: () => ({ user: ETAT.user, status: 'ready' }) }))
vi.mock('../../hooks/useLocale', () => ({
  default: s => ({ t: getCopy(s, ETAT.code), locale: ETAT.code }),
}))

const { default: TrainerHome } = await import('./TrainerHome.jsx')
globalThis.IS_REACT_ACT_ENVIRONMENT = true

// Date figée : la session en cours et celle d'octobre du jeu de démo sont « à venir ».
beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-01T09:00:00')) })
afterAll(() => { vi.useRealTimers() })

let host, root
async function rendu(user, code) {
  Object.assign(ETAT, { user, code })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => { root.render(<MemoryRouter><TrainerHome /></MemoryRouter>) })
  return host.innerHTML
}
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('portail du formateur : rendu figé', () => {
  it.each(['fr', 'en', 'pt'])('sans session à venir (%s)', async code => {
    expect(await rendu(SANS_SESSION, code)).toMatchSnapshot()
  })

  it.each(['fr', 'en', 'pt'])('avec sessions à venir (%s)', async code => {
    const html = await rendu(AVEC_SESSIONS, code)
    expect(host.querySelector('section#sessions-a-venir')).not.toBeNull()
    expect(html).toMatchSnapshot()
  })
})
