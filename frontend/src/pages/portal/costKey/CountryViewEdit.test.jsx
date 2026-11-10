// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getCopy } from '../../../i18n/index.js'
import { makeFormatter } from '../../../components/sheet/sheetExport'

vi.mock('../../../hooks/useLocale', () => ({ default: s => ({ t: getCopy(s, 'fr'), locale: 'fr' }) }))
vi.mock('../../../lib/planningApi', () => ({ planningApi: {} }))
vi.mock('../../../data/academy/equipe-poles.json', () => ({
  default: { poles: [{ members: [{ name: 'Awa TESTEUR', photo: '/assets/team/awa-testeur.png' }] }] },
}))

const { planningApi } = await import('../../../lib/planningApi')
const { CountryView } = await import('./costKeyViews.jsx')

globalThis.IS_REACT_ACT_ENVIRONMENT = true
Element.prototype.scrollIntoView = () => {} // absent de jsdom
const T = getCopy('costKey', 'fr')
const KEY = { id: 'k1', year: 2027, pole: 'MOTORS', status: 'DRAFT' }
const COUNTRIES = { rows: [{ country: 'CG', label: 'Congo' }], brands: [] }

const session = (edit = {}, seats = 6) => ({
  brand: 'TOYOTA', code: 'T-01', title: 'Moteur', start_date: '2027-03-01', end_date: '2027-03-05',
  trainers: [], location: 'Douala', host: 'CM', seats,
  edit: {
    key: 'k1', frozen: false, session: 's1', allocation: 'a1',
    raw: { seats, start_date: '2027-03-01', end_date: '2027-03-05', location: 'Douala', title: 'Moteur' }, ...edit,
  },
})
const payload = sessions => ({
  country: 'CG', label: 'Congo', sessions, brands: [],
  footer: { seats: 6, share: 0.2, key_cost: 1, trainee_lodging: 1, trainer_lodging: 1, total: 3, needs: 8, coverage: 0.75 },
})

const flush = async () => {
  for (let i = 0; i < 5; i += 1) await act(async () => { await new Promise(r => setTimeout(r, 0)) })
}

let host, root, onEdited
async function show(props = {}) {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => {
    root.render(
      <CountryView t={T} locale="fr" fmt={makeFormatter('fr')} ckey={KEY} mode="PLANNED" global={COUNTRIES}
        code="CG" setCode={() => {}} slots={{ title: null, tools: null }} canEdit onEdited={onEdited} {...props} />,
    )
  })
  await flush()
}

const editable = () => [...host.querySelectorAll('td.is-editable')]
const startCell = () => editable()[1]
const seatsCell = () => editable()[4]
const fire = (el, event) => act(async () => { el.dispatchEvent(event) })
const dblclick = el => fire(el, new MouseEvent('dblclick', { bubbles: true }))
const press = (el, key) => fire(el, new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
const input = () => host.querySelector('input.sheet-edit')
async function type(value) {
  const el = input()
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function enter(cell, value) {
  await dblclick(cell)
  await type(value)
  await press(input(), 'Enter')
  await flush()
}
const conflict = (details = {}) => Object.assign(new Error('conflict'), {
  status: 409,
  code: 'CELL_CONFLICT',
  payload: { error: { details: { current: 9, changed_by: 'Une collègue', changed_at: '2027-01-05T10:00:00Z', source: 'CELL', ...details } } },
})
const alertBox = () => document.querySelector('.ck-cell-alert')
const button = label => [...alertBox().querySelectorAll('button')].find(b => b.textContent === label)

beforeEach(() => {
  onEdited = vi.fn().mockResolvedValue(undefined)
  Object.assign(planningApi, {
    country: vi.fn().mockResolvedValue(payload([session()])),
    editCell: vi.fn().mockResolvedValue({ changed: true, value: 8, edited_at: '2027-01-05T11:00:00Z' }),
  })
})

afterEach(async () => {
  await act(async () => { root.unmount() })
  host.remove()
})

describe('saisie dans le devis par filiale', () => {
  it('permet de modifier la date de début de la session', async () => {
    await show()
    await enter(startCell(), '2027-03-08')
    expect(planningApi.editCell).toHaveBeenCalledWith('k1', expect.objectContaining({
      target: 'session', field: 'start_date', expected: '2027-03-01', value: '2027-03-08',
    }))
  })

  it('envoie la valeur vue au départ, puis actualise le tableau et la vue globale', async () => {
    await show()
    await enter(seatsCell(), '8')
    expect(planningApi.editCell).toHaveBeenCalledWith('k1', { target: 'allocation', id: 'a1', field: 'seats', expected: 6, value: 8 })
    expect(planningApi.country).toHaveBeenCalledTimes(2)
    expect(onEdited).toHaveBeenCalledTimes(1)
  })

  it('valide aussi quand la cellule perd le focus', async () => {
    await show()
    await dblclick(seatsCell())
    await type('8')
    await act(async () => { input().dispatchEvent(new FocusEvent('focusout', { bubbles: true })) })
    await flush()
    expect(planningApi.editCell).toHaveBeenCalledTimes(1)
  })

  it('n’envoie rien sur Échap, ni si la valeur ne change pas', async () => {
    await show()
    await dblclick(seatsCell())
    await type('8')
    await press(input(), 'Escape')
    await flush()
    expect(input()).toBeNull()
    await enter(seatsCell(), '6')
    expect(planningApi.editCell).not.toHaveBeenCalled()
  })

  it('garde la cellule ouverte sur une saisie non valide', async () => {
    await show()
    await enter(seatsCell(), '0')
    expect(input()).not.toBeNull()
    expect(planningApi.editCell).not.toHaveBeenCalled()
  })

  it('un conflit montre l’autre valeur, puis « remplacer » repart de celle-ci', async () => {
    planningApi.editCell.mockRejectedValueOnce(conflict())
    await show()
    await enter(seatsCell(), '8')
    expect(alertBox().textContent).toContain('Une collègue')
    expect(alertBox().textContent).toContain('9')
    await act(async () => { button(T.conflict_replace).click() })
    await flush()
    expect(planningApi.editCell).toHaveBeenLastCalledWith('k1', { target: 'allocation', id: 'a1', field: 'seats', expected: 9, value: 8 })
    expect(alertBox()).toBeNull()
  })

  it('un conflit « garder » n’envoie plus rien et affiche la valeur de l’autre', async () => {
    planningApi.editCell.mockRejectedValueOnce(conflict())
    planningApi.country
      .mockResolvedValueOnce(payload([session()]))
      .mockResolvedValueOnce(payload([session({}, 9)]))
    await show()
    await enter(seatsCell(), '8')
    await act(async () => { button(T.conflict_keep).click() })
    await flush()
    expect(planningApi.editCell).toHaveBeenCalledTimes(1)
    expect(alertBox()).toBeNull()
    expect(seatsCell().textContent).toContain('9')
  })

  it('un conflit causé par un import le dit', async () => {
    planningApi.editCell.mockRejectedValueOnce(conflict({ source: 'IMPORT', changed_by: '' }))
    await show()
    await enter(seatsCell(), '8')
    expect(alertBox().textContent).toContain(T.conflict_import)
  })

  it('une valeur refusée par le serveur n’actualise pas', async () => {
    planningApi.editCell.mockRejectedValueOnce(Object.assign(new Error('bad'), { status: 400, code: 'END_BEFORE_START' }))
    await show()
    await enter(seatsCell(), '8')
    expect(alertBox().textContent).toContain(T.err_END_BEFORE_START)
    expect(planningApi.country).toHaveBeenCalledTimes(1)
    expect(onEdited).not.toHaveBeenCalled()
  })

  it('ne laisse pas saisir sans le droit', async () => {
    await show({ canEdit: false })
    expect(editable()).toHaveLength(0)
    const cell = host.querySelector('td[data-cell]')
    await dblclick(cell)
    expect(input()).toBeNull()
  })

  it('montre la photo du formateur, ou ses initiales s’il n’en a pas', async () => {
    planningApi.country.mockResolvedValue(payload([{ ...session(), trainers: ['Awa TESTEUR', 'Formateur externe'] }]))
    await show()
    expect(host.querySelector('img.sheet-c-avatar').getAttribute('src')).toBe('/assets/team/awa-testeur.png')
    expect(host.querySelector('.sheet-c-avatar.is-initials').textContent).toBe('FE')
    expect(host.querySelector('.sheet-c-trainer-names').textContent).toBe('Awa TESTEUR, Formateur externe')
  })

  it('affiche les places face aux besoins et le taux de couverture du besoin', async () => {
    await show()
    expect(host.textContent).toContain('Nombre de places attribuées / Besoins')
    expect(host.textContent).toContain('6 / 8')
    expect(host.textContent).toContain('2 besoins non couverts')
    expect(host.textContent).toContain('Taux de couverture du besoin')
  })

  it('colore les places selon leur destination et montre les trois compteurs', async () => {
    planningApi.country.mockResolvedValue({
      ...payload([{ ...session(), seat_status: 'postponed', postponed: 6 }]),
      footer: { ...payload([]).footer, in_subsidiary: 1, at_academy: 2, postponed: 3 },
    })
    await show()
    expect(seatsCell().classList.contains('tone-place-postponed')).toBe(true)
    const counter = key => host.querySelector(`.ck-kpi--split .ck-split--${key}`).textContent
    expect(counter('in_subsidiary')).toBe('En filiale1')
    expect(counter('at_academy')).toBe('À l\'Academy2')
    expect(counter('postponed')).toBe('Reportées3')
    expect(host.querySelector('.ck-kpi-split small').textContent).toBe('Restent comptées et facturées')
  })

  describe('indicateurs et filtres', () => {
    const row = (allocation, brand, brand_code, location, site, seats, extra = {}) => ({
      ...session({ allocation }, seats), brand, brand_code, location, site, postponed: 0, seat_status: site,
      code: allocation, start_date: '2027-03-01', key_cost: seats * 10, trainee_lodging: seats, trainer_lodging: 1, ...extra,
    })
    const footer = {
      seats: 10, key_cost: 100, trainee_lodging: 10, trainer_lodging: 3, total: 113, needs: 16, coverage: 0.625,
      in_subsidiary: 6, at_academy: 2, postponed: 2, needs_by_brand: { toyota: 5, suzuki: 11 },
    }
    const rows = () => [
      row('a1', 'Toyota', 'toyota', 'Douala', 'at_academy', 4, { postponed: 2, seat_status: 'postponed' }),
      row('a2', 'Suzuki', 'suzuki', 'Douala', 'in_subsidiary', 3),
      row('a3', 'Suzuki', 'suzuki', 'Tana', 'in_subsidiary', 3),
    ]
    const load = async (sessions = rows(), foot = footer) => {
      planningApi.country.mockResolvedValue({ ...payload(sessions), footer: foot })
      await show()
    }
    const kpi = label => [...host.querySelectorAll('.ck-kpi')].find(k => k.querySelector('dt').textContent === label)
    const value = label => kpi(label).querySelector('dd').textContent.replace(/\s/g, ' ')
    const split = key => host.querySelector(`.ck-split--${key} b`).textContent
    const choose = async (index, val) => {
      const el = host.querySelectorAll('.ck-pill-select select')[index]
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, val)
        el.dispatchEvent(new Event('change', { bubbles: true }))
      })
      await flush()
    }

    it('range les filtres à gauche et les outils à droite', async () => {
      await load()
      const bar = host.querySelector('.sheet-toolbar')
      const items = [...bar.children].map(el => el.className || el.tagName)
      const sep = items.indexOf('sheet-toolbar-sep')
      expect(items.indexOf('sheet-search')).toBeLessThan(sep)
      expect(items.indexOf('ck-pill-select')).toBeLessThan(sep)
      expect(items.indexOf('sheet-pop')).toBeGreaterThan(sep)
    })

    it('« Tout effacer » retire aussi les filtres Marque, Mois et Lieu', async () => {
      await load()
      await choose(0, 'Toyota')
      const clear = [...host.querySelectorAll('.sheet-toolbar button')].find(b => b.textContent === 'Tout effacer')
      await act(async () => { clear.click() })
      await flush()
      expect(host.querySelectorAll('.ck-pill-select select')[0].value).toBe('')
      expect(value(T.kpi_seats_needs)).toBe('10 / 16')
    })

    it('annonce le filtre au-dessus des indicateurs, seulement si des lignes sont masquées', async () => {
      await load()
      expect(host.textContent).not.toContain(T.filter_on)
      await choose(0, 'Toyota')
      expect(host.textContent).toMatch(new RegExp(`${T.filter_on} : Toyota · \\d+ / \\d+ lignes`))
    })

    it('explique sous la somme totale ce qu’elle additionne', async () => {
      await load()
      expect(kpi(T.col_total).querySelector('.ck-kpi-note').textContent).toBe(T.kpi_total_note)
    })

    it('garde les chiffres du serveur sans filtre', async () => {
      await load()
      expect(value(T.kpi_seats_needs)).toBe('10 / 16')
      expect(split('at_academy')).toBe('2')
    })

    it('suit la marque choisie, besoin et taux compris', async () => {
      await load()
      await choose(0, 'Toyota')
      expect(value(T.kpi_seats_needs)).toBe('4 / 5')
      expect(value(T.col_coverage)).toBe('80,0 %')
      expect([split('in_subsidiary'), split('at_academy'), split('postponed')]).toEqual(['0', '2', '2'])
      expect(kpi(T.col_coverage).textContent).not.toContain(T.kpi_needs_by_brand_note)
    })

    it('n’invente pas de besoin pour un filtre qui coupe une marque', async () => {
      await load()
      await choose(2, 'Tana')
      expect(value(T.kpi_seats)).toBe('3')
      expect(value(T.col_coverage)).toBe('—')
      expect(kpi(T.col_coverage).textContent).toContain(T.kpi_needs_by_brand_note)
    })

    it('suit aussi la recherche du tableau', async () => {
      await load()
      const search = host.querySelector('.sheet-search input')
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(search, 'Tana')
        search.dispatchEvent(new Event('input', { bubbles: true }))
      })
      await flush()
      expect(value(T.kpi_seats)).toBe('3')
    })

    it('ne donne pas de total partiel sur une clé à budget fixe', async () => {
      await load(rows().map(s => ({ ...s, key_cost: null })))
      await choose(2, 'Tana')
      expect(value(T.col_total)).toBe('—')
    })
  })

  it('fusionne le niveau dans une même marque, pas entre deux marques', async () => {
    const row = (brand, level, level_tier, code) => ({ ...session(), brand, level, level_tier, code })
    planningApi.country.mockResolvedValue(payload([
      row('TOYOTA', 'G4', 'JUNIOR', 'A1'), row('TOYOTA', 'G4', 'JUNIOR', 'A2'), row('TOYOTA', 'G3', 'SENIOR', 'A3'),
      row('SUZUKI', 'G3', 'SENIOR', 'B1'), row('SUZUKI', null, null, 'B2'), row('SUZUKI', null, null, 'B3'),
    ]))
    await show()
    const chips = [...host.querySelectorAll('.sheet-c-level')]
    expect(chips.map(c => c.textContent)).toEqual(['G4', 'G3', 'G3'])
    expect(chips.map(c => c.closest('td').rowSpan)).toEqual([2, 1, 1])
    expect(chips[0].className).toContain('is-junior')
  })

  it('propose le barème de la marque et enregistre le niveau choisi', async () => {
    const edit = { levels: ['G4', 'G3'], raw: { seats: 6, level: 'G4' } }
    planningApi.country.mockResolvedValue(payload([{ ...session(edit), level: 'G4', level_tier: 'JUNIOR' }]))
    planningApi.editCell = vi.fn().mockResolvedValue({ changed: true })
    await show()
    await dblclick(host.querySelector('.sheet-c-level').closest('td'))
    const select = host.querySelector('select.sheet-edit')
    expect([...select.options].map(o => o.textContent)).toEqual(['—', 'G4', 'G3'])
    await act(async () => {
      select.value = 'G3'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await flush()
    expect(planningApi.editCell).toHaveBeenCalledWith('k1', {
      target: 'session', id: 's1', field: 'level', expected: 'G4', value: 'G3',
    })
  })

  it('explique pourquoi un module hors catalogue reste en lecture seule', async () => {
    planningApi.country.mockResolvedValue(payload([{ ...session({ levels: null }), level: null, in_catalog: false }]))
    await show()
    expect(host.querySelector(`span[title="${T.level_not_in_catalog}"]`)).not.toBeNull()
    expect(host.querySelector('.sheet-c-level')).toBeNull()
  })

  it('ne laisse pas saisir sur une clé gelée', async () => {
    planningApi.country.mockResolvedValue(payload([session({ frozen: true })]))
    await show()
    expect(editable()).toHaveLength(0)
  })
})

describe('gel après saisie', async () => {
  const { default: PrepareView } = await import('./PrepareView.jsx')
  const STAMP = '2027-01-05T10:00:00+00:00'
  let onRefresh
  const showFreeze = async () => {
    onRefresh = vi.fn()
    await show({})
    await act(async () => {
      root.render(
        <PrepareView t={T} fmt={makeFormatter('fr')} access={{ freeze: true }} ckey={{ ...KEY, last_edit_at: STAMP }}
          onKeyChange={() => {}} onDataChanged={() => {}} onRefresh={onRefresh} />,
      )
    })
    await flush()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  }
  const clickFreeze = async () => {
    await act(async () => { [...host.querySelectorAll('button')].find(b => b.textContent === T.freeze.replace('{year}', KEY.year)).click() })
    await flush()
  }

  it('renvoie le jeton de la dernière saisie lue', async () => {
    planningApi.freeze = vi.fn().mockResolvedValue({ ...KEY, status: 'FROZEN' })
    await showFreeze()
    await clickFreeze()
    expect(planningApi.freeze).toHaveBeenCalledWith('k1', STAMP)
  })

  it('une saisie intervenue entre-temps prévient et actualise', async () => {
    planningApi.freeze = vi.fn().mockRejectedValue(Object.assign(new Error('stale'), { status: 409, code: 'FREEZE_STALE' }))
    await showFreeze()
    await clickFreeze()
    expect(host.textContent).toContain(T.err_FREEZE_STALE)
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })
})
