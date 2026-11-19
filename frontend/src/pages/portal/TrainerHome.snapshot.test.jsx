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
// Réponses de `GET /api/v1/planning/me/sessions`, au format de l'API.
const session = (id, code, title, start, end) => ({
  id, code, title, brand: 'Toyota', brand_code: 'toyota', pole: 'MOTORS',
  start_date: start, end_date: end, country: 'cm', country_label: 'Cameroun',
  location: 'Centre CFAO Academy — Douala', delivery_mode: 'PRESENTIEL', days: 3, close: false,
})
const REPONSES = {
  f1: { linked: true, sessions: [] },
  f2: { linked: true, sessions: [
    session('s1', 'TSH01', 'Intervention en sécurité sur un véhicule hybride TOYOTA', '2026-08-31', '2026-09-04'),
    session('s2', 'TS02', '', '2026-10-12', '2026-10-14'),
  ] },
}
const ETAT = { user: SANS_SESSION, code: 'fr', reponse: null }
vi.mock('../../hooks/useAuth', () => ({ default: () => ({ user: ETAT.user, status: 'ready' }) }))
vi.mock('../../lib/planningApi.js', () => ({
  planningApi: { mySessions: () => (ETAT.reponse ? Promise.resolve(ETAT.reponse) : Promise.reject(new Error('hors ligne'))) },
}))
vi.mock('../../hooks/useLocale', () => ({
  default: s => ({ t: getCopy(s, ETAT.code), locale: ETAT.code }),
}))

const { default: TrainerHome } = await import('./TrainerHome.jsx')
globalThis.IS_REACT_ACT_ENVIRONMENT = true

// Date figée : la session en cours et celle d'octobre du jeu de démo sont « à venir ».
beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-01T09:00:00')) })
afterAll(() => { vi.useRealTimers() })

let host, root
async function rendu(user, code, reponse = REPONSES[user.id]) {
  Object.assign(ETAT, { user, code, reponse })
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

  it('les sessions viennent du planning : en cours, à venir, titre ou code', async () => {
    await rendu(AVEC_SESSIONS, 'fr')
    const cartes = [...host.querySelectorAll('section#sessions-a-venir .portal-card-anchor')]
    expect(cartes.map(c => c.querySelector('.portal-status-chip').textContent)).toEqual(['En cours', 'À venir'])
    expect(cartes[1].textContent).toContain('TS02')
    // Inscrits inconnus du planning : pas de « 0 stagiaire » inventé.
    expect(host.querySelector('section#sessions-a-venir').textContent).not.toMatch(/stagiaire/)
  })

  it.each([
    ['sans session', { linked: true, sessions: [] }, 'sessions_empty'],
    ['compte pas relié au planning', { linked: false, sessions: [] }, 'sessions_unlinked'],
    ['planning injoignable', null, 'sessions_error'],
  ])('%s : message clair à la place des cartes', async (_, reponse, cle) => {
    await rendu(SANS_SESSION, 'fr', reponse)
    const section = host.querySelector('section#sessions-a-venir')
    expect(section.querySelector('.portal-empty-panel').textContent).toBe(getCopy('trainerHome', 'fr')[cle])
    expect(section.querySelector('.portal-card-anchor')).toBeNull()
  })
})
