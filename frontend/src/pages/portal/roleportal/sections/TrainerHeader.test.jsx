// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCopy } from '../../../../i18n/index.js'

vi.mock('../../../../components/AnimatedCount.jsx', () => ({ default: ({ value }) => <>{value}</> }))
vi.mock('../../../../hooks/useLocale', () => ({ default: s => ({ t: getCopy(s, 'fr'), locale: 'fr' }) }))

const { default: TrainerHeader } = await import('./TrainerHeader.jsx')
globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root
afterEach(() => { act(() => root.unmount()); host.remove() })

function rendre(marques) {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  const user = { id: 'f1', roles: ['trainer'], firstName: 'Jacques', lastName: 'MAVILA' }
  act(() => root.render(<MemoryRouter><TrainerHeader ctx={{ user }} values={{ marques }} /></MemoryRouter>))
}

const logos = () => [...host.querySelectorAll('.portal-header-geo-brands img')]

describe('haut de page du formateur', () => {
  it('affiche la phrase chiffrée et le logo de chacune de ses marques, sans clic', () => {
    rendre(['toyota', 'suzuki'])
    expect(host.querySelector('.portal-header-dps-stats').textContent.replace(/\s+/g, ' ').trim())
      .toBe('À l’Academy, vous formez les techniciens CFAO sur 2 marques')
    expect(logos()).toHaveLength(2)
    // Grands logos, comme ceux des instructeurs.
    expect(host.querySelector('.portal-header-geo-row--instructor')).not.toBeNull()
    expect(host.querySelector('.portal-hero-brands-trigger')).toBeNull()
  })

  it('sans marque connue : en-tête par défaut, ni phrase chiffrée ni logo', () => {
    rendre([])
    expect(host.querySelector('.portal-header-dps-stats')).toBeNull()
    expect(logos()).toHaveLength(0)
  })
})
