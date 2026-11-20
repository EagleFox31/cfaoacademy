// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCopy } from '../i18n/index.js'

vi.mock('./PortalReveal.jsx', () => ({ default: ({ id, children }) => <section id={id}>{children}</section> }))
vi.mock('./PortalStaggerGrid.jsx', () => ({ default: ({ children }) => <div>{children}</div> }))
vi.mock('../hooks/useLocale', () => ({ default: s => ({ t: getCopy(s, 'fr'), locale: 'fr' }) }))

const { default: DpsAssistanceSection } = await import('./DpsAssistanceSection.jsx')
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const t = getCopy('portal', 'fr')
const TICKETS = [
  { id: 'a', brand: 'toyota', status: 'open', subject: 'A', collaboratorName: 'X', ord: '1', updated: 'd' },
  { id: 'b', brand: 'toyota', status: 'resolved', subject: 'B', collaboratorName: 'X', ord: '2', updated: 'd' },
  { id: 'c', brand: 'suzuki', status: 'open', subject: 'C', collaboratorName: 'X', ord: '3', updated: 'd' },
]

let host, root
afterEach(() => { act(() => root.unmount()); host.remove() })

function rendre(props) {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<MemoryRouter><DpsAssistanceSection t={t} {...props} /></MemoryRouter>))
}

const boutons = () => [...host.querySelectorAll('button.chip')]

describe('DpsAssistanceSection, variante formateur', () => {
  it('sans carte « Contacter un expert », avec un filtre par marque', () => {
    rendre({ tickets: TICKETS, variant: 'trainer', enConstruction: 'En construction' })
    expect(host.querySelector('[data-portal-support]')).toBeNull()
    expect(host.querySelectorAll('.portal-dps-ticket-card')).toHaveLength(3)
    const marque = boutons().find(b => b.textContent.startsWith('Suzuki'))
    expect(marque).toBeTruthy()
    act(() => marque.click())
    expect(host.querySelectorAll('.portal-dps-ticket-card')).toHaveLength(1)
    // Les compteurs de statut suivent la marque choisie.
    const ouverts = boutons().find(b => b.textContent.startsWith(t.dps_assistance_filter_open))
    expect(ouverts.textContent).toContain('1')
  })

  it('sans filtre de marque quand une seule marque est présente', () => {
    rendre({ tickets: TICKETS.filter(tk => tk.brand === 'toyota'), variant: 'trainer' })
    expect(boutons().some(b => b.textContent.startsWith(t.dps_filter_all_brands))).toBe(false)
  })

  it('message vide propre au formateur', () => {
    rendre({ tickets: [], variant: 'trainer' })
    expect(host.textContent).toContain(t.trainer_assistance_empty_all)
  })

  it('le DPS garde sa carte « Contacter » et aucun filtre de marque', () => {
    rendre({ tickets: TICKETS })
    expect(host.querySelector('[data-portal-support]')).not.toBeNull()
    expect(boutons().some(b => b.textContent.startsWith(t.dps_filter_all_brands))).toBe(false)
  })
})
