// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import PvCard from './PvCard.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const IMG = '/assets/hero/default.jpg'
let host
let root

function carte(props) {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<MemoryRouter><PvCard title="Carte" {...props} /></MemoryRouter>))
  return {
    wrap: () => host.querySelector('.pv-card-img'),
    img: () => host.querySelector('.pv-card-img img'),
  }
}

afterEach(() => { act(() => root.unmount()); host.remove() })

describe('PvCard — images responsives', () => {
  it('sert les variantes WebP avec srcset, sizes, dimensions et chargement différé', () => {
    const { wrap, img } = carte({ img: IMG })
    expect(img().getAttribute('src')).toMatch(/^\/assets\/_r\/hero\/default-\d+\.webp$/)
    expect(img().getAttribute('srcset')).toMatch(/-480\.webp 480w/)
    expect(img().getAttribute('sizes')).toContain('420px')
    expect(Number(img().getAttribute('width'))).toBeGreaterThan(0)
    expect(Number(img().getAttribute('height'))).toBeGreaterThan(0)
    expect(img().getAttribute('loading')).toBe('lazy')
    expect(img().getAttribute('decoding')).toBe('async')
    expect(wrap().className).toContain('has-flou')
    expect(wrap().style.getPropertyValue('--img-flou')).toContain('data:image/webp;base64,')
  })

  it("passe à l'état chargé au load, puis retombe sur l'original si la variante échoue", () => {
    const { wrap, img } = carte({ img: IMG })
    expect(wrap().className).not.toContain('is-loaded')
    act(() => { img().dispatchEvent(new Event('load')) })
    expect(wrap().className).toContain('is-loaded')
    act(() => { img().dispatchEvent(new Event('error')) })
    expect(img().getAttribute('src')).toBe(IMG)
    expect(img().hasAttribute('srcset')).toBe(false)
    expect(wrap().className).not.toContain('has-flou')
  })

  it("garde l'image telle quelle hors manifeste", () => {
    const { wrap, img } = carte({ img: 'https://exemple.test/a.jpg' })
    expect(img().getAttribute('src')).toBe('https://exemple.test/a.jpg')
    expect(img().hasAttribute('srcset')).toBe(false)
    expect(wrap().className).toBe('pv-card-img')
  })
})
