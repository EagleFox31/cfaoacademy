// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getCopy } from '../i18n/index.js'

vi.mock('./PortalReveal.jsx', () => ({ default: ({ id, children }) => <section id={id}>{children}</section> }))
vi.mock('../hooks/useLocale', () => ({ default: s => ({ t: getCopy(s, 'fr'), locale: 'fr' }) }))
const campaigns = vi.fn()
vi.mock('../lib/needsApi.js', () => ({ needsApi: { campaigns: () => campaigns() } }))

const { default: DpsTrainingNeedsSection, pickCampaigns } = await import('./DpsTrainingNeedsSection.jsx')
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const t = getCopy('portal', 'fr')

let host, root
beforeEach(() => { campaigns.mockReset() })
afterEach(() => { act(() => root.unmount()); host.remove() })

async function rendre() {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => { root.render(<MemoryRouter><DpsTrainingNeedsSection t={t} /></MemoryRouter>) })
  await act(async () => { await new Promise(r => setTimeout(r, 0)) })
}

const cartes = () => [...host.querySelectorAll('.portal-campaign-card')]

describe('DpsTrainingNeedsSection : campagnes lues dans cfao-needs', () => {
  it('affiche année, statut et échéance de chaque campagne, la plus récente d’abord', async () => {
    campaigns.mockResolvedValue({
      next: null,
      results: [
        { id: 'b', year: 2026, label: 'Besoins 2026', status: 'CLOSED', closes_at: null },
        { id: 'a', year: 2027, label: 'Besoins 2027', status: 'OPEN', closes_at: '2026-12-15T00:00:00Z' },
      ],
    })
    await rendre()
    expect(cartes()).toHaveLength(2)
    const [premiere, seconde] = cartes()
    expect(premiere.textContent).toContain('2027')
    expect(premiere.textContent).toContain(t.dps_needs_status_open)
    expect(premiere.textContent).toContain('15 décembre 2026')
    expect(seconde.textContent).toContain(t.dps_needs_status_closed)
    expect(seconde.textContent).toContain('—')
  })

  it('aucune campagne : message neutre, aucune carte', async () => {
    campaigns.mockResolvedValue({ next: null, results: [] })
    await rendre()
    expect(cartes()).toHaveLength(0)
    expect(host.textContent).toContain(t.dps_needs_empty)
  })

  it('API injoignable : message neutre, aucune campagne inventée', async () => {
    campaigns.mockRejectedValue(new Error('hors ligne'))
    await rendre()
    expect(cartes()).toHaveLength(0)
    expect(host.textContent).toContain(t.dps_needs_unavailable)
  })

  it('garde au plus trois campagnes valides', () => {
    const rows = [2023, 2024, 2025, 2026, null].map(year => ({ year }))
    expect(pickCampaigns({ results: rows }).map(c => c.year)).toEqual([2026, 2025, 2024])
    expect(pickCampaigns(null)).toEqual([])
  })
})
