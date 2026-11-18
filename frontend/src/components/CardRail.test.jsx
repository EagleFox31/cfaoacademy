// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import CardRail from './CardRail.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
globalThis.ResizeObserver ??= class { observe() {} disconnect() {} }
let host
let root

afterEach(() => { act(() => root.unmount()); host.remove() })

describe('CardRail — responsive', () => {
  it("ne fige pas le nombre de cartes en inline : les media queries doivent pouvoir le réduire", () => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    act(() => root.render(<CardRail visibleCount={3}><div>a</div><div>b</div></CardRail>))
    const style = host.querySelector('.card-rail').style
    expect(style.getPropertyValue('--rail-count')).toBe('')
    expect(style.getPropertyValue('--rail-count-lg')).toBe('3')
  })

  it('réduit à 2 cartes sous 900 px et à 1 sous 560 px', () => {
    const css = readFileSync(`${process.cwd()}/src/styles/academy.css`, 'utf8')
    expect(css).toMatch(/max-width: 900px\)\s*\{\s*\.card-rail \{ --rail-count: min\(2,/)
    expect(css).toMatch(/max-width: 560px\)\s*\{\s*\.card-rail \{ --rail-count: 1;/)
  })
})
