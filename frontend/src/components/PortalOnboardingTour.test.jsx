// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PortalOnboardingTour from './PortalOnboardingTour.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root, cible
afterEach(() => {
  act(() => root.unmount())
  host.remove(); cible.remove()
  delete document.documentElement.dataset.echelle
  vi.useRealTimers()
})

describe('visite guidée', () => {
  it('écran dézoomé : le cadre entoure la cible, mesures ramenées en pixels CSS', async () => {
    vi.useFakeTimers()
    window.scrollTo = () => {}
    document.documentElement.dataset.echelle = '0.8'
    cible = document.createElement('div')
    cible.setAttribute('data-portal-locale', '')
    // Position à l'écran : 800 px du bord gauche, 40 px du haut, 40 x 32.
    cible.getBoundingClientRect = () => ({ top: 40, left: 800, right: 840, bottom: 72, width: 40, height: 32 })
    document.body.appendChild(cible)

    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    const steps = [{ target: '[data-portal-locale]', title: 'Langue', body: '…', padding: 0 }]
    await act(async () => {
      root.render(<PortalOnboardingTour steps={steps} stepIndex={0} onStepIndexChange={() => {}} onClose={() => {}} t={{}} />)
    })
    await act(async () => { vi.advanceTimersByTime(1000) })

    const trou = document.querySelector('.portal-onboarding-hole')
    expect(trou.style.left).toBe('1000px')
    expect(trou.style.top).toBe('50px')
    expect(trou.style.width).toBe('50px')
    expect(trou.style.height).toBe('40px')
  })
})
