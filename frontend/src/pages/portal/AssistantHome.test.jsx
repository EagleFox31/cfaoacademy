// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCopy } from '../../i18n/index.js'
import { getPortalNavSections } from '../../data/index.js'
import { lienPlanning } from '../../utils/planningAccess.js'
import { CALENDRIER, PART_DES_FILIALES } from './roleportal/configs/assistant.js'
import { pastilleSession, sessionsProches } from './roleportal/sources/assistant.js'
import AssistantSessionsSection from './roleportal/sections/AssistantSessionsSection.jsx'
import PortalHeroKpis from '../../components/PortalHeroKpis.jsx'
import assistant from './roleportal/configs/assistant.js'
import { resolveView } from './Portal.jsx'

const NAV = { props: null }
vi.mock('../../components/Nav', () => ({ default: p => { NAV.props = p; return null } }))
vi.mock('../../components/Footer', () => ({ default: () => null }))
vi.mock('../../components/PortalDemoBar', () => ({ default: () => null }))
vi.mock('../../components/PortalStickyBar', () => ({ default: () => null }))
const HEADER = { props: null }
vi.mock('../../components/PortalHeader', () => ({
  default: p => { HEADER.props = p; return <div className="hero">{p.belowGreeting}</div> },
}))
const DEFILE = vi.fn()
vi.mock('../../utils/portalScroll.js', () => ({ scrollToPortalSection: id => DEFILE(id) }))
vi.mock('../../components/PortalReveal.jsx', () => ({
  default: ({ id, children }) => <section id={id}>{children}</section>,
}))
vi.mock('../../components/PortalStaggerGrid.jsx', () => ({ default: ({ children }) => <div>{children}</div> }))
vi.mock('../../hooks/useSiteEffects', () => ({ default: () => {} }))
vi.mock('../../hooks/usePortalBackground', () => ({ default: () => {} }))
vi.mock('../../hooks/usePortalHeaderHeight.js', () => ({ default: () => {} }))
vi.mock('../../hooks/useAjustementEcran.js', () => ({ default: () => {} }))
vi.mock('../../hooks/useAuth', () => ({ default: () => ({ user: { id: 'a1', roles: ['center_assistant'] }, status: 'ready' }) }))
vi.mock('../../hooks/useLocale', () => ({ default: s => ({ t: getCopy(s, 'fr'), locale: 'fr' }) }))

const { default: AssistantHome } = await import('./AssistantHome.jsx')
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const t = getCopy('assistantHome', 'fr')

let host, root
async function monter(element) {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => { root.render(<MemoryRouter>{element}</MemoryRouter>) })
}
afterEach(() => {
  if (!root) return
  act(() => root.unmount()); host.remove(); root = null
})

const texteDe = id => host.querySelector(`section#${id}`).textContent

describe("portail de l'assistante du centre", () => {
  it('a son propre portail ; directeur et coordinateur gardent celui du centre', () => {
    expect(resolveView(['center_assistant'])).toEqual({ vue: 'assistant' })
    expect(resolveView(['training_coordinator'])).toMatchObject({ vue: 'center', props: { mode: 'coordinator' } })
  })

  it('3 sections dans l’ordre validé, alignées sur la navbar', async () => {
    await monter(<AssistantHome />)
    const ancres = [...host.querySelectorAll('section[id]')].map(s => s.id)
    expect(ancres).toEqual(['prochaines-sessions', 'dossiers', 'a-consulter'])
    expect(getPortalNavSections(['center_assistant']).map(s => s.id)).toEqual(ancres)
    expect(HEADER.props.centerHero).toMatchObject({ mode: 'assistant' })
  })

  it('hero : 3 chiffres sans donnée (« — »), chacun mène à la carte où agir', async () => {
    await monter(<AssistantHome />)
    const cartes = [...host.querySelectorAll('.hero button.portal-kpi-card')]
    expect(cartes.map(b => b.querySelector('.portal-kpi-value').textContent)).toEqual(['—', '—', '—'])
    expect(cartes.map(b => b.querySelector('.portal-kpi-label').textContent))
      .toEqual([t.kpi_sessions, t.kpi_travel, t.kpi_invites])
    DEFILE.mockClear()
    for (const b of cartes) act(() => b.click())
    const cibles = DEFILE.mock.calls.map(c => c[0])
    expect(cibles).toEqual(['prochaines-sessions', 'dossiers-logistique', 'dossiers-invitations'])
    for (const id of cibles) expect(host.querySelector(`#${id}`)).not.toBeNull()
  })

  it('hero : orange s’il reste à faire, vert et rassurant à zéro', async () => {
    await monter(<PortalHeroKpis kpis={assistant.heroKpis} t={t} values={{ aPreparer: 3, sansVoyage: 1, invitationsAEnvoyer: 0 }} />)
    const v = [...host.querySelectorAll('.portal-kpi-value')]
    const l = [...host.querySelectorAll('.portal-kpi-label')].map(e => e.textContent)
    expect(v.map(e => e.textContent)).toEqual(['3', '1', '0'])
    expect(v.map(e => e.className)).toEqual(['portal-kpi-value progress', 'portal-kpi-value progress', 'portal-kpi-value green'])
    expect(l).toEqual([t.kpi_sessions, t.kpi_travel_one, t.kpi_invites_zero])
  })

  it('navbar : la cloche des alertes à la place du menu d’aide', async () => {
    await monter(<AssistantHome />)
    expect(NAV.props).toMatchObject({ hideHelp: true, notifications: [] })
  })

  it('sans source de sessions, la section est annoncée en construction', async () => {
    await monter(<AssistantHome />)
    expect(texteDe('prochaines-sessions')).toContain(t.sessions_card)
    expect(texteDe('prochaines-sessions')).toContain(t.under_construction)
  })

  it('5 dossiers dans l’ordre du travail, en construction', async () => {
    await monter(<AssistantHome />)
    const titres = [...host.querySelectorAll('section#dossiers h3')].map(h => h.textContent)
    expect(titres).toEqual([t.rooms_card, t.trainees_card, t.travel_card, t.invites_card, t.certificates_card])
  })

  it('à consulter : le calendrier et la part des filiales s’ouvrent en lecture', async () => {
    await monter(<AssistantHome />)
    expect(texteDe('a-consulter')).toContain(t.calendar_card)
    expect(PART_DES_FILIALES).toBe(lienPlanning('table', {}, '/portail'))
    expect(CALENDRIER).toBe(lienPlanning('calendar', {}, '/portail'))
    const liens = [...host.querySelectorAll('section#a-consulter a[href]')].map(a => a.getAttribute('href'))
    expect(liens).toEqual([CALENDRIER, PART_DES_FILIALES])
  })
})

describe('prochaines sessions', () => {
  const s = (id, debut, fin, extra = {}) => ({ id, debut, fin, marque: 'TOYOTA', pole: 'Motors', ...extra })

  it('garde les sessions en cours et celles qui commencent dans les 14 jours', () => {
    const liste = [s('loin', '2026-12-10', '2026-12-12'), s('finie', '2026-11-10', '2026-11-18'),
      s('cours', '2026-11-17', '2026-11-21'), s('bientot', '2026-12-03', '2026-12-05')]
    expect(sessionsProches(liste, '2026-11-19').map(x => x.id)).toEqual(['cours', 'bientot'])
  })

  it('pastille : Prête, N choses à faire, ou rien si la liste est inconnue', () => {
    expect(pastilleSession({ aFaire: 0 })).toEqual({ cls: 'done', key: 'session_ready' })
    expect(pastilleSession({ aFaire: 2 })).toEqual({ cls: 'alert', key: 'session_todo', n: 2 })
    expect(pastilleSession({})).toBeNull()
  })

  it('une fiche par session : intitulé, formateur, lieu, places', async () => {
    const sessions = [s('a', '2026-11-23', '2026-11-27', {
      intitule: 'Freinage', formateur: 'Formateur A', lieu: 'Douala', inscrits: 9, aFaire: 2 })]
    await monter(<AssistantSessionsSection t={t} locale="fr" values={{ sessions }} />)
    const texte = host.textContent
    for (const attendu of ['Freinage', 'Formateur A', 'Douala', '9 / 12 places', '2 choses à faire']) {
      expect(texte).toContain(attendu)
    }
  })

  it('aucune session : une phrase, pas de carte', async () => {
    await monter(<AssistantSessionsSection t={t} locale="fr" values={{ sessions: [] }} />)
    expect(host.textContent).toBe(t.sessions_empty)
  })
})
