// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import PvCard from './PvCard.jsx'
import { LocaleProvider } from '../context/LocaleProvider.jsx'
import { baseBesoins, versBesoins } from '../utils/urlBesoins.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let host
let root

function carte(props) {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(
    <LocaleProvider><MemoryRouter><PvCard title="Carte" img="/assets/hero/default.jpg" {...props} /></MemoryRouter></LocaleProvider>,
  ))
  return host
}

afterEach(() => { act(() => root.unmount()); host.remove() })

describe('PvCard — carte sans destination', () => {
  it('garde son visuel, perd lien, CTA et coin, et porte le chantier pour le survol', () => {
    const h = carte({ enConstruction: 'En construction', onClick: () => {}, to: '/x', cta: 'Ouvrir', corner: true })
    const card = h.querySelector('.pv-card')
    expect(card.tagName).toBe('DIV')
    expect(card.classList.contains('pv-card--en-construction')).toBe(true)
    expect(h.querySelector('.pv-card-img img')).not.toBeNull()
    expect(h.querySelector('.pv-card-construction').textContent).toContain('En construction')
    expect(h.querySelector('.pv-cta-link')).toBeNull()
    expect(h.querySelector('.corner')).toBeNull()
  })

  it('un CTA sans destination met la carte en construction d’office', () => {
    const h = carte({ cta: 'Ouvrir' })
    expect(h.querySelector('.pv-card').classList.contains('pv-card--en-construction')).toBe(true)
    expect(h.querySelector('.pv-card-construction').textContent).toContain('Fonctionnalité en construction')
    expect(h.querySelector('.pv-cta-link')).toBeNull()
  })

  it('une carte d’information (ni CTA ni destination) reste telle quelle', () => {
    const h = carte({})
    expect(h.querySelector('.pv-card-construction')).toBeNull()
  })

  it('une carte avec destination reste un lien, sans chantier', () => {
    const h = carte({ to: '/x', cta: 'Ouvrir' })
    expect(h.querySelector('a.pv-card')).not.toBeNull()
    expect(h.querySelector('.pv-card-construction')).toBeNull()
  })
})

describe('recueil des besoins : lien seulement s’il est configuré', () => {
  it('sans VITE_NEEDS_URL, pas d’adresse morte : la carte passe en construction', () => {
    expect(baseBesoins({})).toBeNull()
    expect(versBesoins('En construction', {})).toEqual({ enConstruction: 'En construction' })
  })

  it('avec VITE_NEEDS_URL, la carte ouvre le module', () => {
    expect(baseBesoins({ VITE_NEEDS_URL: 'https://needs.example/' })).toBe('https://needs.example')
    expect(typeof versBesoins('x', { VITE_NEEDS_URL: 'https://needs.example' }).onClick).toBe('function')
  })
})
