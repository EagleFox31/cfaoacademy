// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getCopy } from '../../i18n/index.js'

// Le menu du module est passé à la navbar (prop appNav) : la maquette l'affiche.
vi.mock('../../components/Nav', () => ({
  default: ({ appNav }) => (
    <nav data-testid="portal-nav">
      {appNav?.items.map(i => <a key={i.key} className="app-nav-item">{i.label}</a>)}
    </nav>
  ),
}))
vi.mock('../../components/Footer', () => ({ default: () => null }))
vi.mock('../../components/PortalDemoBar', () => ({ default: () => null }))
vi.mock('../../hooks/useSiteEffects', () => ({ default: () => {} }))
const AUTH = { user: { id: 'u1', roles: ['x'] }, status: 'ready' }
vi.mock('../../hooks/useAuth', () => ({ default: () => AUTH }))
vi.mock('../../hooks/useLocale', () => ({ default: s => ({ t: getCopy(s, 'fr'), locale: 'fr' }) }))
vi.mock('../../lib/planningApi', () => ({ planningApi: {} }))

const { planningApi } = await import('../../lib/planningApi')
const awaitedModule = await import('./CleRepartition.jsx')
const { default: CleRepartition } = awaitedModule

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const T = getCopy('costKey', 'fr')

const KEY = { id: 7, year: 2026, pole: 'MOTORS', status: 'DRAFT', budget: 1000000 }
const ROW = (country, label, seats, needs) => ({
  country, label, enrolled: true, technicians: 10, needs, seats, coverage: needs ? seats / needs : null,
  share: 0.5, key_cost: 400000, trainee_lodging: 50000, trainer_lodging: 50000, total: 500000,
  cells: { TOYOTA: { needs, technicians: 10, seats, coverage: needs ? seats / needs : null } },
})
const GLOBAL = (partial = false) => ({
  year: 2026, pole: 'MOTORS', mode: 'PLANNED', status: 'DRAFT', budget: 1000000, total_seats: 30,
  hourly_cost: 5000, needs_source: 'needs_api', warnings: [], partial,
  brands: [{ code: 'TOYOTA', label: 'Toyota' }, { code: 'FUSO', label: 'Fuso' }],
  brand_totals: { TOYOTA: { needs: 40, technicians: 20, seats: 30, coverage: 0.75 }, FUSO: { needs: 0, seats: 0 } },
  rows: partial ? [ROW('CM', 'Cameroun', 20, 25)] : [ROW('CM', 'Cameroun', 20, 25), ROW('CI', 'Côte d’Ivoire', 10, 15)],
})

let host, root
async function show(path) {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/portail/cle-repartition" element={<CleRepartition />} />
          <Route path="/portail/cle-repartition/:view" element={<CleRepartition />} />
        </Routes>
      </MemoryRouter>,
    )
  })
  for (let i = 0; i < 5; i += 1) await act(async () => { await new Promise(r => setTimeout(r, 0)) })
}
const menuLabels = () => [...host.querySelectorAll('.app-nav-item')].map(n => n.textContent)

beforeEach(() => {
  Object.assign(planningApi, {
    keys: vi.fn().mockResolvedValue([KEY]),
    global: vi.fn().mockResolvedValue(GLOBAL()),
    country: vi.fn().mockResolvedValue({
      ...GLOBAL(true), country: 'CM', label: 'Cameroun',
      sessions: [{ brand: 'TOYOTA', code: 'T-01', title: 'Moteur', start_date: '2026-03-02', end_date: '2026-03-06',
        trainers: ['A. B.'], location: 'Douala', host: 'CM', seats: 6 }],
      footer: { seats: 6, share: 0.2, key_cost: 1, trainee_lodging: 1, trainer_lodging: 1, total: 3, needs: 8, coverage: 0.75 },
    }),
    imports: vi.fn().mockResolvedValue([]),
  })
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('Clé de répartition : menu par rôle et vue tableur', () => {
  it('équipe Academy : navbar du portail, 5 entrées, tableau des pays avec totaux', async () => {
    planningApi.access = vi.fn().mockResolvedValue({ view: true, manage: true, freeze: true, import: true, gaps: true })
    await show('/portail/cle-repartition')

    expect(host.querySelector('[data-testid="portal-nav"]')).not.toBeNull()
    expect(menuLabels()).toEqual([T.nav_table, T.nav_country, T.nav_compare, T.nav_themes, T.nav_prepare])
    const body = host.querySelector('.sheet-table tbody').textContent
    expect(body).toContain('Cameroun')
    expect(body).toContain('Côte d’Ivoire')
    // total des places dans le pied, marque vide (Fuso) masquée
    expect(host.querySelector('.sheet-table tfoot').textContent).toContain('30')
    const headers = host.querySelector('.sheet-head').textContent
    expect(headers).toContain('Toyota')
    expect(headers).not.toContain('Fuso')
    expect(host.textContent).toContain(T.xlsx_table)
  })

  it('observateur (DPS/DOP) : rien à préparer', async () => {
    planningApi.access = vi.fn().mockResolvedValue({ view: true, manage: false, freeze: false, import: false, gaps: true })
    await show('/portail/cle-repartition')
    expect(menuLabels()).not.toContain(T.nav_prepare)
    expect(menuLabels()).toHaveLength(4)
  })

  it('filiale : « Mon pays » d’abord, ouvert d’office sur sa fiche', async () => {
    planningApi.access = vi.fn().mockResolvedValue({ view: true, manage: false, freeze: false, import: false, gaps: false })
    planningApi.global = vi.fn().mockResolvedValue(GLOBAL(true))
    await show('/portail/cle-repartition')
    expect(menuLabels()).toEqual([T.nav_country_scoped, T.nav_table, T.nav_compare])
    expect(host.textContent).toContain(T.partial)
    expect(planningApi.country).toHaveBeenCalledWith(7, 'CM', 'PLANNED')
    expect(host.querySelector('.sheet-table tbody').textContent).toContain('Moteur')
  })

  it('sans droit : message clair, aucun menu', async () => {
    planningApi.access = vi.fn().mockResolvedValue({ view: false })
    await show('/portail/cle-repartition')
    expect(menuLabels()).toEqual([])
    expect(host.textContent).toContain(T.no_access)
  })

  it('aucune clé et droit de préparer : ouvre la création', async () => {
    planningApi.access = vi.fn().mockResolvedValue({ view: true, manage: true, freeze: true, import: true, gaps: true })
    planningApi.keys = vi.fn().mockResolvedValue([])
    await show('/portail/cle-repartition')
    expect(host.textContent).toContain(T.create_title)
  })
})

describe('resolveScope : année + pôle', () => {
  const { resolveScope } = awaitedModule
  const M26 = { id: 1, year: 2026, pole: 'MOTORS' }
  const E26 = { id: 2, year: 2026, pole: 'EQUIPMENT' }
  const M25 = { id: 3, year: 2025, pole: 'MOTORS' }
  const q = s => new URLSearchParams(s)

  it('par défaut : année la plus récente, Tous pôles consolidé', () => {
    const s = resolveScope([M25, E26, M26], q(''))
    expect(s).toMatchObject({ years: [2026, 2025], year: 2026, pole: 'ALL', allPoles: true })
    expect(s.ckey).toBe(M26)
  })
  it('une seule clé dans l’année : Tous = cette clé (pas de consolidation)', () => {
    const s = resolveScope([M25, E26, M26], q('annee=2025'))
    expect(s).toMatchObject({ year: 2025, pole: 'ALL', allPoles: false, ckey: M25 })
  })
  it('ancien lien ?cle= : année et pôle de la clé', () => {
    expect(resolveScope([M25, E26, M26], q('cle=2'))).toMatchObject({ year: 2026, pole: 'EQUIPMENT', ckey: E26, allPoles: false })
  })
  it('pôle sans clé cette année : ckey nul ; pôle inconnu : Tous', () => {
    expect(resolveScope([M25], q('pole=equipment')).ckey).toBeNull()
    expect(resolveScope([M25], q('pole=xyz')).pole).toBe('ALL')
  })
})
