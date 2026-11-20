// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCopy } from '../../../i18n/index.js'
import { ApiError } from '../../../lib/api.js'

vi.mock('../../../hooks/useSiteEffects', () => ({ default: () => {} }))
vi.mock('../../../hooks/usePortalBackground', () => ({ default: () => {} }))
vi.mock('../../../components/LocaleSwitch', () => ({ default: () => null }))
const ETAT = { user: null, lang: 'fr' }
vi.mock('../../../hooks/useAuth', () => ({ default: () => ({ user: ETAT.user, status: 'ready' }) }))
vi.mock('../../../hooks/useLocale', () => ({
  default: s => ({ t: getCopy(s, ETAT.lang), locale: ETAT.lang, setLocale: () => {} }),
}))
const API = vi.hoisted(() => ({}))
vi.mock('../../../lib/supervisionApi', () => ({ supervisionApi: API }))

const { default: SupervisionConsole } = await import('./SupervisionConsole.jsx')
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const OPS = { id: 'o1', roles: ['platform_ops'], firstName: 'Awa', lastName: 'Diop' }
const recent = new Date(Date.now() - 3 * 60000).toISOString()

const MODULE = (project, status, extra = {}) => ({
  project, name: project.replace('cfao-', ''), status, since: recent, version: 'v0.2.0', version_detail: null,
  deployed_at: recent, containers: 2, problems: status === 'ok' ? 0 : 1, ports: [8005], provides: [], ...extra,
})

const OVERVIEW = {
  collected_at: recent, stale: false, sources: {},
  counts: { ok: 2, done: 0, starting: 0, degraded: 0, crashloop: 0, down: 1 },
  modules: [
    MODULE('cfao-needs', 'ok', { last_connection: { user: 'jdupont', project: 'cfao-needs', last_at: recent } }),
    MODULE('cfao-planning', 'down', { last_connection: { user: null, project: 'cfao-planning', last_at: recent } }),
    MODULE('cfao-core', 'ok', { last_connection: null }),
  ],
}

const REFUSED = {
  hours: 24, window_min: 60, threshold: 10, retention_days: 7, alerts: 1, total: 15,
  source: { ok: true, last_success_at: recent },
  networks: [
    { network: '192.168.10.0/24', total: 14, recent: 12, last_at: recent, alert: true, addresses: 2, ips: [
      { ip: '192.168.10.42', total: 12, recent: 12, ports: [8444, 8445], first_at: recent, last_at: recent, alert: true },
      { ip: '192.168.10.7', total: 2, recent: 0, ports: [8092], first_at: recent, last_at: recent, alert: false },
    ] },
    { network: '10.0.0.0/24', total: 1, recent: 1, last_at: recent, alert: false, addresses: 1, ips: [
      { ip: '10.0.0.5', total: 1, recent: 1, ports: [], first_at: recent, last_at: recent, alert: false },
    ] },
  ],
}

function stub({ access = { board: true, connections: true }, overview = OVERVIEW, module, history, deps, connections, refused } = {}) {
  API.refused = vi.fn().mockResolvedValue(refused ?? REFUSED)
  API.access = vi.fn().mockResolvedValue(access)
  API.overview = vi.fn().mockResolvedValue(overview)
  API.module = module ?? vi.fn().mockResolvedValue({})
  API.history = vi.fn().mockResolvedValue(history ?? { events: [] })
  API.dependencies = vi.fn().mockResolvedValue(deps ?? { links: [], unused: [] })
  API.connections = vi.fn().mockResolvedValue(connections ?? { retention_days: 7, connections: [] })
}

let host, root
async function show(path, { user = OPS, lang = 'fr' } = {}) {
  ETAT.user = user
  ETAT.lang = lang
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/portail" element={<p>PORTAIL</p>} />
          <Route path="/portail/supervision" element={<SupervisionConsole />} />
          <Route path="/portail/supervision/modules/:project" element={<SupervisionConsole />} />
          <Route path="/portail/supervision/:view" element={<SupervisionConsole />} />
        </Routes>
      </MemoryRouter>,
    )
  })
  await act(async () => {})
  await act(async () => {})
}
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('supervision', () => {
  it('renvoie au portail un compte sans le rôle', async () => {
    stub()
    await show('/portail/supervision', { user: { roles: ['trainer'] } })
    expect(host.textContent).toBe('PORTAIL')
    expect(API.access).not.toHaveBeenCalled()
  })

  it('renvoie au portail quand le serveur refuse la lecture', async () => {
    stub({ access: { board: false, connections: false } })
    await show('/portail/supervision')
    expect(host.textContent).toBe('PORTAIL')
  })

  it.each(['fr', 'en', 'pt'])('état des modules : chiffres, pannes en tête, aucun texte manquant (%s)', async lang => {
    stub()
    const t = getCopy('supervision', lang)
    await show('/portail/supervision', { lang })
    expect(host.querySelector('h1').textContent).toBe(t.title_overview)
    expect([...host.querySelectorAll('.dlv-kpi-v')].slice(0, 3).map(n => n.textContent)).toEqual(['2', '0', '1'])
    const cards = [...host.querySelectorAll('a.dlv-node')]
    expect(cards.map(c => c.getAttribute('href'))).toEqual([
      '/portail/supervision/modules/cfao-planning',
      '/portail/supervision/modules/cfao-core',
      '/portail/supervision/modules/cfao-needs',
    ])
    expect(cards[0].className).toContain('crit')
    expect(cards[0].textContent).toContain(t.status_down)
    expect(cards[0].textContent).toContain(t.user_unknown)
    expect(cards[1].textContent).toContain(t.no_connection)
    expect(cards[2].textContent).toContain('jdupont')
    expect(host.textContent).not.toMatch(/undefined|NaN|\{\w+\}/)
  })

  it('prévient quand la collecte est figée ou n’a jamais tourné', async () => {
    stub({ overview: { ...OVERVIEW, stale: true } })
    await show('/portail/supervision')
    expect(host.querySelector('.dlv-readonly').textContent).toMatch(/collecteur est peut-être arrêté/)
    act(() => root.unmount()); host.remove()

    stub({ overview: { ...OVERVIEW, stale: true, collected_at: null } })
    await show('/portail/supervision')
    expect(host.querySelector('.dlv-readonly').textContent).toBe(getCopy('supervision', 'fr').never_collected)
  })

  it('sans le droit « connexions » : ni menu, ni page, ni colonne', async () => {
    const { last_connection: _drop, ...bare } = OVERVIEW.modules[0]
    stub({ access: { board: true, connections: false }, overview: { ...OVERVIEW, modules: [bare] } })
    await show('/portail/supervision/connections')
    expect(host.querySelector('h1').textContent).toBe(getCopy('supervision', 'fr').title_overview)
    expect([...host.querySelectorAll('.dlv-nav-item')].map(a => a.getAttribute('href')))
      .not.toContain('/portail/supervision/connections')
    expect(host.textContent).not.toContain(getCopy('supervision', 'fr').last_connection)
    expect(API.connections).not.toHaveBeenCalled()
  })

  it('fiche d’un module : conteneurs, nouveautés absentes dites en clair, historique', async () => {
    const t = getCopy('supervision', 'fr')
    stub({
      module: vi.fn().mockResolvedValue({
        ...MODULE('cfao-planning', 'down'), public_prefix: '/api/v1/planning', changelog: '',
        container_list: [
          { service: 'api', number: 1, name: 'cfao-planning-api-1', status: 'down', counted: true, since: recent,
            version: 'v0.2.0', revision: 'abc123def456', restart_count: 4, ports: [{ public: 8005, private: 8000 }],
            provides: { 'planning-api': '1.0.0' }, consumes: { 'identity-me': '^1' } },
          { service: 'worker', number: 1, name: 'cfao-planning-worker-1', status: 'down', counted: false, since: null,
            version: null, revision: '', restart_count: 0, ports: [], provides: {}, consumes: {} },
        ],
        connections: [],
      }),
      history: { events: [{ at: recent, service: 'api', kind: 'state', before: 'running', after: 'exited' }] },
    })
    await show('/portail/supervision/modules/cfao-planning')
    expect(API.module).toHaveBeenCalledWith('cfao-planning')
    expect(host.querySelector('.dlv-nav-item.is-active').getAttribute('href')).toBe('/portail/supervision')
    expect(host.textContent).toContain(t.changelog_missing)
    expect(host.textContent).toContain(t.container_ignored)
    expect(host.textContent).toContain('8005 → 8000')
    expect(host.textContent).toContain('planning-api')
    expect(host.textContent).toContain(t.way_consumes)
    expect(host.textContent).toContain(t.kind_state)
    expect(host.textContent).toContain(t.version_unknown)
    expect(host.textContent).not.toMatch(/undefined|NaN|\{\w+\}/)
  })

  it('fiche d’un module : nouveautés affichées quand l’image les porte', async () => {
    stub({
      module: vi.fn().mockResolvedValue({
        ...MODULE('cfao-needs', 'ok'), public_prefix: '', changelog: '### Ajouté\n- Export des besoins',
        container_list: [],
      }),
    })
    await show('/portail/supervision/modules/cfao-needs')
    expect(host.querySelector('.dlv-changelog').textContent).toContain('Export des besoins')
  })

  it('module inconnu : le dit, sans planter', async () => {
    stub({ module: vi.fn().mockRejectedValue(new ApiError(404, 'not found')) })
    await show('/portail/supervision/modules/inconnu')
    expect(host.textContent).toContain(getCopy('supervision', 'fr').module_unknown)
  })

  it('API entre modules : chaque lien a son état en clair', async () => {
    const t = getCopy('supervision', 'fr')
    stub({
      deps: {
        links: [
          { contract: 'identity-me', consumer: 'cfao-planning', expects: '^1', provider: 'cfao-core', provides: '1.2.0', status: 'ok' },
          { contract: 'needs-api', consumer: 'cfao-planning', expects: '^2', provider: 'cfao-needs', provides: '1.0.0', status: 'incompatible' },
          { contract: 'cr-api', consumer: 'cfao-core', expects: '^1', provider: null, provides: null, status: 'missing' },
        ],
        unused: [{ contract: 'planning-api', provider: 'cfao-planning', provides: '1.0.0' }],
      },
    })
    await show('/portail/supervision/dependencies')
    const states = [...host.querySelectorAll('tbody .dlv-status')].map(n => n.textContent)
    expect(states).toEqual([t.link_ok, t.link_incompatible, t.link_missing])
    expect(host.textContent).toContain('planning-api')
  })

  it('dernières connexions : compte inconnu dit en clair, durée de conservation', async () => {
    const t = getCopy('supervision', 'fr')
    stub({
      connections: {
        retention_days: 7,
        connections: [
          { user: 'jdupont', project: 'cfao-needs', module: 'Besoins', last_at: recent, last_login_at: recent, last_activity_at: recent },
          { user: null, project: 'cfao-core', module: 'Core', last_at: recent, last_login_at: null, last_activity_at: recent },
        ],
      },
    })
    await show('/portail/supervision/connections')
    const rows = host.querySelectorAll('tbody tr')
    expect(rows).toHaveLength(2)
    expect(rows[1].textContent).toContain(t.user_unknown)
    expect(host.textContent).toContain('7')
  })

  it('état des modules : pastille vers les connexions refusées seulement en cas d’alerte', async () => {
    const t = getCopy('supervision', 'fr')
    stub({ overview: { ...OVERVIEW, refused: { alerts: 2, recent: 30 } } })
    await show('/portail/supervision')
    const alert = host.querySelector('a.dlv-alert')
    expect(alert.getAttribute('href')).toBe('/portail/supervision/refused')
    expect(alert.textContent).toContain('2 poste(s) bloqué(s)')
    act(() => root.unmount()); host.remove()

    for (const refused of [{ alerts: 0, recent: 3 }, null]) {
      stub({ overview: { ...OVERVIEW, refused } })
      await show('/portail/supervision')
      expect(host.querySelector('a.dlv-alert')).toBeNull()
      expect(host.textContent).not.toContain(t.refused_alert_link)
      act(() => root.unmount()); host.remove()
    }
    stub()
    await show('/portail/supervision')
  })

  it.each(['fr', 'en', 'pt'])('connexions refusées : par réseau, poste insistant signalé, aucun texte manquant (%s)', async lang => {
    const t = getCopy('supervision', lang)
    stub()
    await show('/portail/supervision/refused', { lang })
    expect(API.refused).toHaveBeenCalledWith(24)
    expect(host.querySelector('h1').textContent).toBe(t.title_refused)
    expect([...host.querySelectorAll('.dlv-kpi-v')].map(n => n.textContent)).toEqual(['1', '15', '3'])
    expect(host.querySelector('.dlv-kpi').className).toContain('crit')
    const rows = [...host.querySelectorAll('tbody tr')]
    expect(rows.map(r => r.className === 'dlv-row-group')).toEqual([true, false, false, true, false])
    expect(rows[1].textContent).toContain('192.168.10.42')
    expect(rows[1].textContent).toContain(t.refused_state_alert)
    expect(rows[1].textContent).toContain('8444, 8445')
    expect(rows[2].textContent).toContain(t.refused_state_isolated)
    expect(rows[4].textContent).toContain('—')
    expect(host.querySelector('.dlv-nav-item.is-active').getAttribute('href')).toBe('/portail/supervision/refused')
    expect(host.textContent).not.toMatch(/undefined|NaN|\{\w+\}/)
  })

  it('connexions refusées : changer de période relance la lecture', async () => {
    stub()
    await show('/portail/supervision/refused')
    const [hour] = host.querySelectorAll('.dlv-periods button')
    await act(async () => { hour.click() })
    await act(async () => {})
    expect(API.refused).toHaveBeenLastCalledWith(1)
    expect(hour.getAttribute('aria-pressed')).toBe('true')
  })

  it('connexions refusées : journal non lu ou en échec, dit en clair', async () => {
    const t = getCopy('supervision', 'fr')
    stub({ refused: { ...REFUSED, source: null, alerts: 0, total: 0, networks: [] } })
    await show('/portail/supervision/refused')
    expect(host.querySelector('.dlv-readonly').textContent).toBe(t.refused_no_source)
    expect(host.textContent).toContain(t.refused_none_no_source)
    act(() => root.unmount()); host.remove()

    stub({ refused: { ...REFUSED, source: { ok: false, last_success_at: null }, networks: [] } })
    await show('/portail/supervision/refused')
    expect(host.querySelector('.dlv-readonly').textContent).toBe(t.refused_source_never)
    expect(host.textContent).toContain(t.refused_none)
  })

  it('connexions refusées : sans le droit, ni menu ni page', async () => {
    stub({ access: { board: true, connections: false } })
    await show('/portail/supervision/refused')
    expect(host.querySelector('h1').textContent).toBe(getCopy('supervision', 'fr').title_overview)
    expect([...host.querySelectorAll('.dlv-nav-item')].map(a => a.getAttribute('href')))
      .not.toContain('/portail/supervision/refused')
    expect(API.refused).not.toHaveBeenCalled()
  })

  it('injoignable : le dit au lieu d’un écran vide', async () => {
    stub()
    API.overview = vi.fn().mockRejectedValue(new ApiError(503, 'down'))
    await show('/portail/supervision')
    expect(host.textContent).toContain(getCopy('supervision', 'fr').load_error)
  })
})
