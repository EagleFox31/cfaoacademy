// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getCopy } from '../../i18n/index.js'

// Le menu du module est passé à la navbar (prop appNav) : la maquette l'affiche.
vi.mock('../../components/Nav', () => ({
  default: ({ appNav, notifications, hideHelp }) => (
    <nav data-testid="portal-nav" data-hide-help={hideHelp ? 'yes' : 'no'}>
      {appNav?.items.map(i => <a key={i.key} className="app-nav-item">{i.label}</a>)}
      {notifications?.map(n => <button key={n.id} type="button" className="test-notif" onClick={n.onOpen}>{n.text}</button>)}
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

const KEY = { id: 7, year: 2026, pole: 'MOTORS', status: 'DRAFT', budget: 1000000, hours_per_session: 40 }
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
    abc: vi.fn().mockResolvedValue({
      year: 2026, pole: 'MOTORS', status: 'DRAFT', budget: 1000000, needs_source: 'needs_api', warnings: [],
      brands: [{ code: 'TOYOTA', label: 'Toyota' }], totals: { a: 20, b: 25, c: 10 }, partial: false,
      rows: [{ country: 'CM', label: 'Cameroun', enrolled: true, a: 20, b: 25, c: 10, a_b: 0.8, a_c: 2,
        share_a: 1, share_b: 1, share_c: 1, amount_a: 1000000, amount_b: 1000000, amount_c: 1000000,
        cells: { TOYOTA: { a: 20, b: 25, c: 10, a_b: 0.8, a_c: 2 } } }],
    }),
    updateKey: vi.fn(async (id, body) => ({ ...KEY, ...body })),
  })
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('Clé de répartition : menu par rôle et vue tableur', () => {
  it('équipe Academy : navbar du portail, 5 entrées, tableau des filiales avec totaux', async () => {
    planningApi.access = vi.fn().mockResolvedValue({ view: true, manage: true, freeze: true, import: true, gaps: true })
    await show('/portail/cle-repartition')

    expect(host.querySelector('[data-testid="portal-nav"]')).not.toBeNull()
    expect(menuLabels()).toEqual([T.nav_table, T.nav_country, T.nav_themes, T.nav_settings, T.nav_prepare])
    // drapeau local devant chaque filiale (jamais de CDN), plus de bascule Prévu / Réalisé
    const flags = [...host.querySelectorAll('.sheet-table tbody img.ck-flag')].map(i => i.getAttribute('src'))
    expect(flags).toEqual(['/assets/flags/cameroon.svg', '/assets/flags/ivory-coast.svg'])
    expect(host.textContent).not.toContain(T.mode_actual)
    const body = host.querySelector('.sheet-table tbody').textContent
    expect(body).toContain('Cameroun')
    expect(body).toContain('Côte d’Ivoire')
    // total des places dans le pied, marque vide (Fuso) masquée
    expect(host.querySelector('.sheet-table tfoot').textContent).toContain('30')
    // une marque = un en-tête sur 3 colonnes : besoin, contractuel, attribué
    const brandHead = [...host.querySelectorAll('.sheet-group.has-group')]
    expect(brandHead.map(th => [th.textContent, th.colSpan])).toEqual([[T.group_all_brands, 1], ['Toyota', 3], [T.group_totals, 8]])
    const headers = [...host.querySelectorAll('.sheet-head .sheet-h-label')].map(s => s.textContent)
    expect(headers.filter(h => [T.col_needs, T.col_allocated].includes(h)))
      .toEqual([T.col_needs, T.col_allocated, T.col_needs, T.col_allocated])
    expect(headers.filter(h => h === T.col_contractual)).toHaveLength(2)
    expect(host.querySelector('.ck-view .ck-seg')).toBeNull()
    expect(host.querySelector('[role=menu]')).toBeNull()
    planningApi.downloadAll = vi.fn().mockResolvedValue()
    const excel = host.querySelector('.ck-xlsx[aria-haspopup=menu]')
    await act(async () => { excel.click() })
    const entries = [...host.querySelectorAll('[role=menuitem]')]
    expect(entries.map(e => e.querySelector('strong').textContent)).toEqual([T.xlsx_table, T.xlsx_all])
    expect(document.activeElement).toBe(entries[0])
    await act(async () => { entries[1].click() })
    expect(planningApi.downloadAll).toHaveBeenCalledOnce()
    expect(host.querySelector('[role=menu]')).toBeNull()
  })

  it('observateur (DPS/DOP) : rien à préparer', async () => {
    planningApi.access = vi.fn().mockResolvedValue({ view: true, manage: false, freeze: false, import: false, gaps: true })
    await show('/portail/cle-repartition')
    expect(menuLabels()).not.toContain(T.nav_prepare)
    expect(menuLabels()).toHaveLength(3)
  })

  it('filiale : « Mon pays » d’abord, ouvert d’office sur sa fiche', async () => {
    planningApi.access = vi.fn().mockResolvedValue({ view: true, manage: false, freeze: false, import: false, gaps: false })
    planningApi.global = vi.fn().mockResolvedValue(GLOBAL(true))
    await show('/portail/cle-repartition')
    expect(menuLabels()).toEqual([T.nav_country_scoped, T.nav_table])
    expect(host.textContent).toContain(T.partial)
    expect(planningApi.country).toHaveBeenCalledWith(7, 'CM', 'PLANNED')
    expect(host.querySelector('.sheet-table tbody').textContent).toContain('Moteur')
  })

  it('Filiale : Cameroun par défaut, combobox avec recherche au clavier', async () => {
    planningApi.access = vi.fn().mockResolvedValue({ view: true, manage: true, freeze: true, import: true, gaps: true })
    const g = GLOBAL()
    planningApi.global = vi.fn().mockResolvedValue({ ...g, rows: [...g.rows].reverse() })
    await show('/portail/cle-repartition/country')
    expect(planningApi.country).toHaveBeenCalledWith(7, 'CM', 'PLANNED')
    const btn = host.querySelector('.ck-combo-btn')
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    await act(async () => { btn.click() })
    const input = host.querySelector('.ck-combo-input')
    expect(document.activeElement).toBe(input)
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    await act(async () => { setValue.call(input, 'cote'); input.dispatchEvent(new Event('input', { bubbles: true })) })
    const opts = [...host.querySelectorAll('[role="option"]')].map(o => o.textContent)
    expect(opts).toEqual(['Côte d’Ivoire'])
    await act(async () => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })) })
    for (let i = 0; i < 3; i += 1) await act(async () => { await new Promise(r => setTimeout(r, 0)) })
    expect(planningApi.country).toHaveBeenLastCalledWith(7, 'CI', 'PLANNED')
    expect(host.querySelector('.ck-combo-panel')).toBeNull()
    expect(host.querySelector('.ck-xlsx').textContent).toContain(T.export)
  })

  const kpiTexts = () => [...host.querySelectorAll('.ck-kpi')].map(n => n.textContent)
  const RESPONSES = pole => ({ pole, answered: ['CM'], known: ['CI', 'CM'] })

  it('cartes : filiales ayant répondu, places attribuées / demandées, total à facturer', async () => {
    planningApi.access = vi.fn().mockResolvedValue({ view: true, manage: true, freeze: true, review: false })
    planningApi.global = vi.fn().mockResolvedValue({ ...GLOBAL(), responses: [RESPONSES('MOTORS')] })
    await show('/portail/cle-repartition/table')
    const kpis = kpiTexts()
    expect(kpis).toHaveLength(3)
    expect(kpis[0]).toContain(T.kpi_responses)
    expect(kpis[0]).toContain('1 / 2')
    expect(kpis[1]).toContain(T.kpi_seats_needs)
    expect(kpis[1]).toContain('30 / 40')
    expect(kpis[2]).toContain(T.kpi_to_bill)
    expect(kpis[2]).toContain(T.currency)
    expect(kpis.join()).not.toContain(T.kpi_review)
  })

  it('cartes : tous pôles, une ligne par pôle ; le coordinateur voit le nombre de points à traiter', async () => {
    planningApi.access = vi.fn().mockResolvedValue({ view: true, manage: true, freeze: true, review: true })
    planningApi.global = vi.fn().mockResolvedValue({ ...GLOBAL(), review_items: [],
      responses: [RESPONSES('EQUIPMENT'), RESPONSES('MOTORS')] })
    await show('/portail/cle-repartition/table')
    const kpis = kpiTexts()
    expect(kpis).toHaveLength(4)
    expect(kpis[0]).toContain(T.kpi_review)
    expect(kpis[0]).toContain('0')
    expect(kpis[1]).toContain(`${T.pole_MOTORS}1 / 2`)
    expect(kpis[1]).toContain(`${T.pole_EQUIPMENT}1 / 2`)
  })

  it('cartes : sans les besoins, aucune filiale n’est annoncée comme n’ayant pas répondu', async () => {
    planningApi.access = vi.fn().mockResolvedValue({ view: true, manage: true, freeze: true, review: false })
    planningApi.global = vi.fn().mockResolvedValue({ ...GLOBAL(), needs_source: 'none',
      responses: [{ pole: 'MOTORS', answered: [], known: ['CI', 'CM'] }] })
    await show('/portail/cle-repartition/table')
    expect(kpiTexts()[0]).not.toContain('0 / 2')
  })

  it('incohérence : un marqueur sur la ligne de la filiale ouvre la session surlignée, sans bandeau', async () => {
    planningApi.access = vi.fn().mockResolvedValue({ view: true, manage: true, freeze: true, import: true, gaps: true })
    planningApi.global = vi.fn().mockResolvedValue({ ...GLOBAL(), review_items: [{
      id: 'r1', country: 'CM', country_label: 'Cameroun', code: 'T-01', seats: 6,
      start_date: '2026-07-19', end_date: '2026-05-28', issue: 'end_before_start', assignee: 'A. B.' }] })
    await show('/portail/cle-repartition/table')
    const row = [...host.querySelectorAll('.sheet-table tbody tr')].find(r => r.textContent.includes('Cameroun'))
    const mark = row.querySelector('button.ck-review-mark')
    expect(mark.title).toContain('T-01')
    expect(host.querySelectorAll('button.ck-review-mark')).toHaveLength(1)
    expect([...host.querySelectorAll('.ck-banner')].some(b => b.textContent.includes('T-01'))).toBe(false)
    expect(host.querySelector('[data-testid="portal-nav"]').dataset.hideHelp).toBe('yes')
    expect(host.querySelector('.test-notif').textContent).toContain('T-01')
    await act(async () => { mark.click() })
    for (let i = 0; i < 5; i += 1) await act(async () => { await new Promise(r => setTimeout(r, 0)) })
    expect(planningApi.country).toHaveBeenCalledWith(7, 'CM', 'PLANNED')
    expect(host.querySelector('tr.is-focus')?.textContent).toContain('T-01')
  })

  it('Vue globale : un clic sur la filiale ouvre son devis, un clic sur un chiffre sélectionne seulement', async () => {
    await show('/portail/cle-repartition/table')
    const row = [...host.querySelectorAll('.sheet-table tbody tr')].find(r => r.textContent.includes('Cameroun'))
    const filiale = row.querySelector('td.is-openable')
    expect(filiale.textContent).toContain('Cameroun')
    expect(row.querySelectorAll('td.is-openable')).toHaveLength(1)
    await act(async () => { row.querySelector('td.is-num').click() })
    expect(planningApi.country).not.toHaveBeenCalled()
    await act(async () => { filiale.click() })
    for (let i = 0; i < 5; i += 1) await act(async () => { await new Promise(r => setTimeout(r, 0)) })
    expect(planningApi.country).toHaveBeenCalledWith(7, 'CM', 'PLANNED')
  })

  it('incohérence : dans le Devis, la cloche retire la recherche qui cachait la session', async () => {
    planningApi.access = vi.fn().mockResolvedValue({ view: true, manage: true, freeze: true, import: true, gaps: true })
    planningApi.global = vi.fn().mockResolvedValue({ ...GLOBAL(), review_items: [{
      id: 'r1', country: 'CM', country_label: 'Cameroun', code: 'T-01', seats: 6,
      start_date: '2026-07-19', end_date: '2026-05-28', issue: 'end_before_start', assignee: 'A. B.' }] })
    await show('/portail/cle-repartition/country?pays=CM')
    const wait = () => act(async () => { await new Promise(r => setTimeout(r, 400)) })
    const input = host.querySelector('.sheet-toolbar input')
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    await act(async () => { setValue.call(input, 'introuvable'); input.dispatchEvent(new Event('input', { bubbles: true })) })
    await wait()
    expect(host.querySelector('tr.is-focus')).toBeNull()
    await act(async () => { host.querySelector('.test-notif').click() })
    await wait()
    expect(host.querySelector('.sheet-toolbar input').value).toBe('')
    const focused = host.querySelector('tr.is-focus')
    expect(focused?.textContent).toContain('T-01')
    expect(focused.querySelector('.ck-review-mark').title).toContain('T-01')
  })

  it('lecteur : la colonne Contractuel reste affichée quand l’effectif n’est pas connu', async () => {
    planningApi.access = vi.fn().mockResolvedValue({ view: true, manage: false, freeze: false, import: false, gaps: false })
    const g = GLOBAL()
    planningApi.global = vi.fn().mockResolvedValue({
      ...g,
      rows: g.rows.map(r => ({ ...r, technicians: null, cells: { TOYOTA: { ...r.cells.TOYOTA, technicians: null } } })),
    })
    await show('/portail/cle-repartition')
    const headers = [...host.querySelectorAll('.sheet-head .sheet-h-label')].map(s => s.textContent)
    expect(headers.filter(h => h === T.col_contractual)).toHaveLength(2)
  })

  it('une filiale avec des besoins ou des places a sa ligne marquée, pas celle qui n’a qu’un effectif', async () => {
    const g = GLOBAL()
    const rempli = { ...g.rows[0], needs: 4, seats: 0 }
    const vide = { ...g.rows[0], country: 'ZZ', needs: 0, seats: 0, technicians: 12 }
    planningApi.global = vi.fn().mockResolvedValue({ ...g, rows: [rempli, vide] })
    await show('/portail/cle-repartition')
    const lignes = [...host.querySelectorAll('.sheet-table tbody tr')]
    expect(lignes.map(tr => tr.classList.contains('is-filled'))).toEqual([true, false])
  })

  it('panneau Colonnes : cases Besoins, Contractuel, Attribué sous chaque marque, plus de bouton Filtres', async () => {
    await show('/portail/cle-repartition')
    const boutons = [...host.querySelectorAll('.sheet-toolbar button')]
    expect(boutons.map(b => b.textContent.trim())).not.toContain('Filtres')
    await act(async () => { boutons.find(b => b.textContent.includes('Colonnes')).click() })
    const toyota = host.querySelector('.sheet-pop-panel [role="group"][aria-label="Toyota"]')
    expect([...toyota.querySelectorAll('label')].map(l => l.textContent))
      .toEqual([T.col_needs, T.col_contractual, T.col_allocated])
    expect(host.querySelector('.sheet-pop-panel').textContent).not.toContain('·')
    await act(async () => { toyota.querySelectorAll('input')[1].click() })
    const marque = [...host.querySelectorAll('.sheet-group.has-group')].find(th => th.textContent === 'Toyota')
    expect(marque.colSpan).toBe(2)
  })

  it('la feuille de style ne fige pas la position des en-têtes (sinon « Filiale » se décale)', () => {
    expect(readFileSync('src/styles/sheet.css', 'utf8')).not.toMatch(/th\.sheet-h\s*\{[^}]*position/)
  })

  it('ABC masqué : un ancien lien retombe sur le tableau, sans charger la vue', async () => {
    planningApi.access = vi.fn().mockResolvedValue({ view: true, manage: false, freeze: false, import: false, gaps: false })
    await show('/portail/cle-repartition/compare?pole=MOTORS')
    expect(host.querySelector('h1').textContent).toBe(T.nav_table)
    expect(planningApi.abc).not.toHaveBeenCalled()
  })

  it('Saisie : au budget fixe par défaut, le tarif remplace le budget une fois choisi', async () => {
    planningApi.access = vi.fn().mockResolvedValue({ view: true, manage: true, freeze: true, import: true, gaps: true })
    await show('/portail/cle-repartition/settings?pole=MOTORS')
    expect(host.textContent).toContain(T.set_budget)
    expect(host.textContent).toContain(T.computed_hour)
    expect(host.textContent).not.toContain(T.f_hourly_rate)
    expect(host.querySelector('.ck-set-bar')).toBeNull()
    await act(async () => { host.querySelector('input[type="radio"][value="rate"]').click() })
    expect(host.textContent).toContain(T.f_hourly_rate)
    expect(host.textContent).toContain(T.set_budget_out)
    expect(host.querySelector('.ck-set-bar button[type="submit"]').disabled).toBe(true)
    const input = [...host.querySelectorAll('label.ck-field')]
      .find(l => l.textContent.includes(T.f_hourly_rate)).querySelector('input')
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      set.call(input, '2500')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => { host.querySelector('.ck-view form.ck-form button[type="submit"]').click() })
    expect(planningApi.updateKey).toHaveBeenCalledWith(7, expect.objectContaining({ hourly_rate: 2500, budget: 1000000 }))
  })

  describe('Saisie : tarif existant', () => {
    const field = label => [...host.querySelectorAll('label.ck-field')]
      .find(l => l.textContent.includes(label)).querySelector('input')
    const type = async (input, value) => act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const open = async () => {
      planningApi.access = vi.fn().mockResolvedValue({ view: true, manage: true, freeze: true, import: true, gaps: true })
      planningApi.keys = vi.fn().mockResolvedValue([{ ...KEY, hourly_rate: 10000, hours_per_session: 40 }])
      await show('/portail/cle-repartition/settings?pole=MOTORS')
    }

    it('affiche le prix de la place et groupe les milliers à la frappe', async () => {
      await open()
      expect(host.querySelector('.ck-set-recap-value').textContent.replace(/\s/g, '')).toContain('400000')
      await type(field(T.f_hourly_rate), '12500a')
      expect(field(T.f_hourly_rate).value).toBe('12 500')
      expect(host.querySelector('.ck-set-recap-value').textContent.replace(/\s/g, '')).toContain('500000')
    })

    it('passer au budget fixe efface le tarif, Annuler rétablit tout', async () => {
      await open()
      expect(host.querySelector('.ck-set-bar')).toBeNull()
      await act(async () => { host.querySelector('input[type="radio"][value="budget"]').click() })
      expect(host.querySelector('.ck-set-bar')).not.toBeNull()
      await act(async () => { [...host.querySelectorAll('.ck-set-bar button')].find(b => b.type === 'button').click() })
      expect(host.querySelector('.ck-set-bar')).toBeNull()
      expect(host.querySelector('input[type="radio"][value="rate"]').checked).toBe(true)
      await act(async () => { host.querySelector('input[type="radio"][value="budget"]').click() })
      await act(async () => { host.querySelector('.ck-set-bar button[type="submit"]').click() })
      expect(planningApi.updateKey).toHaveBeenCalledWith(7, expect.objectContaining({ hourly_rate: null, budget: 1000000 }))
    })

    it('sans heures par session : enregistrement bloqué, message clair', async () => {
      await open()
      await type(field(T.f_hours), '')
      expect(host.querySelector('.ck-set-bar button[type="submit"]').disabled).toBe(true)
      expect(host.querySelector('.ck-set-bar').textContent).toContain(T.set_required_hours)
    })
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

  it('mise à jour trop longue : message « mise à jour », pas « le service ne répond pas »', async () => {
    const { ApiError } = await import('../../lib/api')
    planningApi.access = vi.fn().mockRejectedValue(new ApiError(503, 'maintenance', { error: { code: 'maintenance' } }))
    await show('/portail/cle-repartition')
    expect(host.textContent).toContain(T.err_maintenance)
    expect(host.textContent).not.toContain(T.error)
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
