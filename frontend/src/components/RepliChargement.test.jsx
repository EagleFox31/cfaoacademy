// @vitest-environment jsdom
import { act, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getCopy } from '../i18n/index.js'
import { DELAI_ENTRE_RECHARGEMENTS_MS, surEchecMorceau } from '../lib/rechargementMorceau.js'

vi.mock('../hooks/useLocale.js', () => ({ default: s => ({ t: getCopy(s, 'fr'), locale: 'fr' }) }))
const { default: RepliChargement } = await import('./RepliChargement.jsx')

globalThis.IS_REACT_ACT_ENVIRONMENT = true

describe('RepliChargement', () => {
  let host
  let root

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
  })
  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    vi.restoreAllMocks()
  })

  it('affiche un message et un bouton quand une page ne se charge pas', async () => {
    const Page = lazy(() => Promise.reject(new Error('morceau absent')))
    await act(async () => {
      root.render(<RepliChargement><Suspense fallback={null}><Page /></Suspense></RepliChargement>)
    })
    const t = getCopy('common', 'fr')
    expect(host.querySelector('[role=alert]').textContent).toContain(t.pageLoadError)
    expect(host.querySelector('button').textContent).toBe(t.pageLoadRetry)
  })

  it('affiche la page quand elle se charge', async () => {
    const Page = lazy(() => Promise.resolve({ default: () => <p>contenu</p> }))
    await act(async () => {
      root.render(<RepliChargement><Suspense fallback={null}><Page /></Suspense></RepliChargement>)
    })
    expect(host.textContent).toBe('contenu')
  })
})

describe('surEchecMorceau', () => {
  const stockage = (valeur = null) => {
    let v = valeur
    return { getItem: () => v, setItem: (_, x) => { v = x } }
  }
  const evenement = () => ({ preventDefault: vi.fn() })

  it('recharge une première fois et bloque l’erreur', () => {
    const e = evenement()
    const recharger = vi.fn()
    surEchecMorceau(e, { stockage: stockage(), recharger, maintenant: 1_000_000 })
    expect(recharger).toHaveBeenCalledOnce()
    expect(e.preventDefault).toHaveBeenCalledOnce()
  })

  it('ne recharge pas deux fois de suite : pas de boucle', () => {
    const s = stockage()
    const recharger = vi.fn()
    surEchecMorceau(evenement(), { stockage: s, recharger, maintenant: 1_000_000 })
    const e = evenement()
    surEchecMorceau(e, { stockage: s, recharger, maintenant: 1_000_000 + DELAI_ENTRE_RECHARGEMENTS_MS - 1 })
    expect(recharger).toHaveBeenCalledOnce()
    expect(e.preventDefault).not.toHaveBeenCalled()
  })

  it('recharge de nouveau passé le délai', () => {
    const s = stockage(String(1_000_000))
    const recharger = vi.fn()
    surEchecMorceau(evenement(), { stockage: s, recharger, maintenant: 1_000_000 + DELAI_ENTRE_RECHARGEMENTS_MS })
    expect(recharger).toHaveBeenCalledOnce()
  })

  it('sans stockage utilisable, ne recharge pas', () => {
    const recharger = vi.fn()
    surEchecMorceau(evenement(), { stockage: null, recharger })
    const plein = { getItem: () => null, setItem: () => { throw new Error('plein') } }
    surEchecMorceau(evenement(), { stockage: plein, recharger })
    expect(recharger).not.toHaveBeenCalled()
  })
})

describe('App : découpage par route', () => {
  it('ne charge d’office aucune page hors connexion', () => {
    const source = readFileSync(resolve(__dirname, '../App.jsx'), 'utf8')
    const pages = [...source.matchAll(/^import \w+ from '\.\/(?:pages|help\/pages)\/([^']+\.jsx)'/gm)].map(m => m[1])
    expect(pages.sort()).toEqual(['AuthCallback.jsx', 'Login.jsx'])
  })

  it('ne ramène pas le portail dans le socle par le tiroir de démo', () => {
    const source = readFileSync(resolve(__dirname, '../utils/demoProfiles.js'), 'utf8')
    expect(source).not.toMatch(/from '[^']*\/Portal(\.jsx)?'/)
  })
})
