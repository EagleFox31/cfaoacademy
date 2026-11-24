// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getCopy } from '../../../i18n/index.js'

vi.mock('../../../lib/planningApi', () => ({ planningApi: {} }))

const { planningApi } = await import('../../../lib/planningApi')
const { default: CalendarView, backToBack, brandParts, calendarFacetDefs, calendarKpis, lanes, lineLabel, monthRows, LEGEND } = await import('./CalendarView.jsx')
const { applyFacets } = await import('./FacetFilter.jsx')

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const T = getCopy('costKey', 'fr')

const flush = async () => {
  for (let i = 0; i < 5; i += 1) await act(async () => { await new Promise(r => setTimeout(r, 0)) })
}

describe('briques du calendrier', () => {
  it('lit les marques écrites : un logo par marque reconnue, le reste en texte', () => {
    const parts = brandParts('TOYOTA CARROSSERIE')
    expect(parts[0]).toEqual({ brand: 'TOYOTA' })
    expect(parts[1]).toEqual({ text: 'CARROSSERIE' })
    expect(brandParts('SUZUKI BYD OMODA & JAECOO').filter(p => p.brand)).toHaveLength(3)
    expect(brandParts('PROCESS & PARTS')).toEqual([{ text: 'PROCESS & PARTS' }])
  })

  it('range deux bandes qui se chevauchent sur deux couloirs', () => {
    const a = { from: 1, to: 5 }, b = { from: 4, to: 8 }, c = { from: 10, to: 12 }
    expect(lanes([b, a, c])).toEqual([[a, c], [b]])
    expect(lanes([])).toEqual([[]])
  })

  it('libellés de ligne : reportées en rouge sur deux colonnes, formateur sinon', () => {
    expect(lineLabel({ section: 'FORMATIONS REPORTEES', brands: '', trainer: '' }, T))
      .toEqual({ wide: true, tail: true, text: T.cal_postponed })
    expect(lineLabel({ section: 'TOYOTA', brands: 'TOYOTA', trainer: 'Formateur A' }, T))
      .toEqual({ brands: 'TOYOTA', trainer: 'Formateur A' })
  })

  it('KPI : sessions, jours ouvrés hors fériés, lieux, formateurs rapprochés, charge', () => {
    const line = (key, trainer, section = 'TOYOTA') => ({ key, section, brands: section, trainer })
    const band = (l, start, end, kind, text = 'X') => ({ line: l, start, end, kind, text, title: '' })
    const kpis = calendarKpis({
      holidays: ['2027-01-01'],
      lines: [line('a', 'Formateur A'), line('a2', 'Formateur A', 'LEXUS'), line('b', 'Formateur B'),
        line('c', 'Formateur C'), line('r', '', 'FORMATIONS REPORTEES')],
      bands: [
        band('a', '2027-01-01', '2027-01-08', 'academy', 'S1'), // ven. férié + 5 jours ouvrés
        band('a2', '2027-01-18', '2027-01-22', 'subsidiary', 'S2'), // 10 jours après S1 : rapprochées
        band('b', '2027-03-01', '2027-03-05', 'client'),
        band('b', '2027-04-05', '2027-04-07', 'subsidiary'), // 31 jours après : pas rapprochées
        band('c', '2027-05-03', '2027-05-07', 'leave'), // congés : pas une formation
        band('r', '2027-06-07', '2027-06-11', 'academy'), // reportée : hors compte
      ],
    })
    expect(kpis.sessions).toBe(4)
    expect(kpis.days).toBe(18)
    expect(kpis.where).toEqual({ academy: 5, subsidiary: 8, other: 5 })
    expect(kpis.closeTrainers).toBe(1)
    expect([...kpis.closeBands].sort()).toEqual(['a2|2027-01-18|S2', 'a|2027-01-01|S1'])
    expect(kpis.busiest).toEqual({ name: 'Formateur A', days: 10 })
    expect(kpis.idle).toBe(1)
  })

  it('formation sur deux semaines enchaînées : la pause se compte après la fin', () => {
    const lines = [{ key: 'a', section: 'TOYOTA', brands: 'TOYOTA', trainer: 'Formateur A' }]
    const band = (start, end, text) => ({ line: 'a', start, end, kind: 'subsidiary', text, title: '' })
    const twoWeeks = [band('2027-03-01', '2027-03-05', 'SS01'), band('2027-03-08', '2027-03-12', 'SS02')]
    expect(calendarKpis({ holidays: [], lines, bands: twoWeeks }).closeTrainers).toBe(0)
    // Lundi férié entre les deux semaines : toujours la même formation.
    const easter = [band('2027-03-22', '2027-03-26', 'SS03'), band('2027-03-30', '2027-04-02', 'SS04')]
    expect(calendarKpis({ holidays: ['2027-03-29'], lines, bands: easter }).closeTrainers).toBe(0)
    // Reprise 10 jours après la fin de la 2e semaine : seules la fin et la reprise sont encadrées.
    const k = calendarKpis({ holidays: [], lines, bands: [...twoWeeks, band('2027-03-22', '2027-03-24', 'BT01')] })
    expect(k.closeTrainers).toBe(1)
    expect([...k.closeBands].sort()).toEqual(['a|2027-03-08|SS02', 'a|2027-03-22|BT01'])
    expect(backToBack('2027-03-04', '2027-03-08', new Set())).toBe(false) // vendredi libre
  })

  it('KPI traduits en fr, en, pt', () => {
    const keys = ['cal_kpi_sessions', 'cal_kpi_sessions_note', 'cal_kpi_where', 'cal_where_academy',
      'cal_where_subsidiary', 'cal_where_other', 'cal_where_note', 'cal_kpi_close', 'cal_kpi_close_note',
      'cal_kpi_busiest', 'cal_kpi_busiest_note', 'cal_kpi_idle']
    for (const lang of ['fr', 'en', 'pt']) {
      const t = getCopy('costKey', lang)
      keys.forEach(k => expect(t[k], `${lang}.${k}`).toBeTruthy())
    }
  })

  it('filtres filiale, marque, formateur, type, mois : les bandes retenues, nom complet du formateur', () => {
    const lines = [
      { key: 'a', section: 'TOYOTA', brands: 'SUZUKI BYD', trainer: 'Lucien', trainer_name: 'Lucien GAGNE' },
      { key: 'b', section: 'TOYOTA', brands: 'TOYOTA', trainer: 'Idris', trainer_name: '' },
    ]
    const bands = [
      { line: 'a', start: '2027-01-04', end: '2027-01-08', kind: 'subsidiary', country: 'ci', country_label: "Côte d'Ivoire", brand: null },
      { line: 'a', start: '2027-03-01', end: '2027-03-05', kind: 'academy', country: null, brand: 'TOYOTA' },
      { line: 'b', start: '2027-03-08', end: '2027-03-12', kind: 'client', country: 'sn', country_label: 'Sénégal', brand: null },
    ]
    const defs = calendarFacetDefs({ t: T, locale: 'fr', year: 2027, lines, bands })
    expect(defs.map(d => d.id)).toEqual(['country', 'brand', 'trainer', 'kind', 'month'])
    const pick = filters => applyFacets(bands, defs, filters)
    expect(pick({ trainer: ['Lucien GAGNE'] })).toHaveLength(2)
    expect(pick({ trainer: ['Idris'] })).toEqual([bands[2]]) // pas de nom complet : le prénom de la grille
    expect(pick({ brand: ['BYD'] })).toEqual([bands[0]]) // marques de la ligne quand la bande n'en dit rien
    expect(pick({ brand: ['TOYOTA'] })).toHaveLength(2)
    expect(pick({ country: ['ci'], month: ['2027-01'] })).toEqual([bands[0]])
    expect(pick({ kind: ['academy', 'client'] })).toHaveLength(2)
    const byLine = new Map([['a', [{ ...bands[0], month: 0, from: 4, to: 8 }]]])
    expect(monthRows(lines, byLine, 0, true).map(r => r.line.key)).toEqual(['a'])
    expect(monthRows(lines, byLine, 1, true)).toEqual([])
    expect(monthRows(lines, byLine, 1, false)).toHaveLength(2) // sans filtre : la grille entière
    for (const lang of ['fr', 'en', 'pt']) {
      const t = getCopy('costKey', lang)
      ;['cal_filter_trainer', 'cal_filter_kind', 'cal_filter_empty', 'filter_country', 'filter_brand', 'filter_month']
        .forEach(k => expect(t[k], `${lang}.${k}`).toBeTruthy())
    }
  })

  it('légende dans l’ordre de la grille Excel, chaque couleur traduite', () => {
    expect(LEGEND).toEqual(['academy', 'subsidiary', 'support', 'trainers', 'client', 'leave', 'holiday'])
    for (const lang of ['fr', 'en', 'pt']) {
      const t = getCopy('costKey', lang)
      LEGEND.forEach(k => expect(t[`cal_kind_${k}`]).toBeTruthy())
    }
  })
})

describe('CalendarView', () => {
  let host, root
  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })
  afterEach(() => {
    act(() => root.unmount())
    host.remove()
  })

  const DATA = {
    year: 2027, pole: 'MOTORS', empty: false, holidays: ['2027-01-01'],
    lines: [
      { key: 'toyota|formateur a', section: 'TOYOTA', brands: 'TOYOTA', trainer: 'Formateur A', trainer_name: 'Formateur ALPHA' },
      { key: 'formations reportees|', section: 'FORMATIONS REPORTEES', brands: '', trainer: '', trainer_name: '' },
    ],
    bands: [{ line: 'toyota|formateur a', start: '2027-01-05', end: '2027-01-09', text: 'TS07 - SENEGAL',
      title: 'Moteur', kind: 'subsidiary' }],
  }

  it('montre la grille : bande fusionnée sur ses jours, férié en violet, week-end gris', async () => {
    planningApi.calendar = vi.fn().mockResolvedValue(DATA)
    act(() => root.render(<CalendarView t={T} locale="fr" year={2027} pole="MOTORS" />))
    await flush()
    expect(planningApi.calendar).toHaveBeenCalledWith(2027, 'MOTORS')
    const january = host.querySelector('tbody.tc-month-block')
    const band = january.querySelector('td.tc-band.tc-subsidiary')
    expect(band.textContent).toBe('TS07 - SENEGAL')
    expect(band.getAttribute('colspan')).toBe('5')
    expect(january.querySelector('td.tc-band.tc-subsidiary.is-title').textContent).toBe('Moteur')
    const firstRow = january.querySelector('tr').querySelectorAll('td')
    expect(firstRow[0].className).toContain('is-holiday') // 1er janvier
    expect(firstRow[1].className).toContain('is-weekend') // samedi 2 janvier 2027
    expect(january.querySelector('.tc-label.is-tail').textContent).toBe(T.cal_postponed)
    expect(host.querySelectorAll('tbody.tc-month-block')).toHaveLength(12)
    const kpis = [...host.querySelectorAll('.ck-kpi')].map(k => k.querySelector('dt').textContent)
    expect(kpis).toEqual([T.cal_kpi_sessions, T.cal_kpi_where, T.cal_kpi_close, T.cal_kpi_busiest])
    expect(host.querySelector('.ck-kpi dd').textContent).toBe('1')
    expect(january.querySelector('.tc-trainer-cell').textContent).toContain('Formateur ALPHA')
    // Barre de filtres au-dessus des KPI, dans l'ordre du Devis.
    const bar = host.querySelector('.ck-filterbar').textContent
    const order = [T.filter_country, T.filter_brand, T.cal_filter_trainer, T.cal_filter_kind, T.filter_month]
    order.forEach(label => expect(bar).toContain(label))
    expect(order.map(label => bar.indexOf(label))).toEqual(order.map(label => bar.indexOf(label)).sort((a, b) => a - b))
  })

  it('sans grille importée : message, pas de tableau vide', async () => {
    planningApi.calendar = vi.fn().mockResolvedValue({ ...DATA, empty: true, lines: [], bands: [] })
    act(() => root.render(<CalendarView t={T} locale="fr" year={2027} pole="MOTORS" />))
    await flush()
    expect(host.querySelector('table')).toBeNull()
    expect(host.textContent).toContain('2027')
  })

  it('sans droit : message dédié', async () => {
    planningApi.calendar = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { status: 403 }))
    act(() => root.render(<CalendarView t={T} locale="fr" year={2027} pole="MOTORS" />))
    await flush()
    expect(host.textContent).toContain(T.cal_no_access)
  })
})
