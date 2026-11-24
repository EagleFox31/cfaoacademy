// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import MiseAJourDisponible from './MiseAJourDisponible.jsx'
import { LocaleContext } from '../context/localeContext.js'
import {
  RAPPEL_MS,
  actualiser,
  comparerVersions,
  estReporte,
  evaluer,
  registerAfterReload,
  registerBeforeReload,
  reporter,
} from '../lib/miseAJour.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const LOCALE = { module: 'portail', version: 'v0.2.5', build: 'b1' }

function reponse(json, ok = true) {
  return vi.fn().mockResolvedValue({ ok, json: async () => json })
}

let racine
let hote

async function monter(props, langue = 'fr') {
  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
  await act(async () => {
    racine.render(
      <LocaleContext.Provider value={{ locale: langue, setLocale() {} }}>
        <MiseAJourDisponible locale={LOCALE} {...props} />
      </LocaleContext.Provider>,
    )
  })
  // Laisse la lecture de version.json se terminer.
  await act(async () => { await Promise.resolve() })
}

function bouton(texte) {
  return [...hote.querySelectorAll('button')].find((b) => b.textContent === texte)
}

beforeEach(() => sessionStorage.clear())
afterEach(() => {
  act(() => racine?.unmount())
  hote?.remove()
  racine = null
  vi.useRealTimers()
})

describe('évaluation de version.json', () => {
  it('rien à proposer si le build est le même, illisible, ou d’un autre module', () => {
    expect(evaluer({ module: 'portail', build: 'b1' }, LOCALE)).toBeNull()
    expect(evaluer(null, LOCALE)).toBeNull()
    expect(evaluer('<html>', LOCALE)).toBeNull()
    expect(evaluer({ module: 'cr', build: 'b2' }, LOCALE)).toBeNull()
    expect(evaluer({ build: 'b2' }, { ...LOCALE, build: '' })).toBeNull()
  })

  it('nouveau build : bandeau ; critique ou client trop ancien : modale', () => {
    expect(evaluer({ module: 'portail', version: 'v0.2.6', build: 'b2' }, LOCALE))
      .toEqual({ build: 'b2', version: 'v0.2.6', critique: false, notesKey: '' })
    expect(evaluer({ build: 'b2', critical: true }, LOCALE).critique).toBe(true)
    expect(evaluer({ build: 'b2', min_client: '0.3.0' }, LOCALE).critique).toBe(true)
    expect(evaluer({ build: 'b2', min_client: '0.2.5' }, LOCALE).critique).toBe(false)
    // Version locale illisible : on ne bloque pas.
    expect(evaluer({ build: 'b2', min_client: '0.3.0' }, { ...LOCALE, version: 'dev' }).critique).toBe(false)
  })

  it('compare les versions champ par champ', () => {
    expect(comparerVersions('v0.2.10', '0.2.9')).toBe(1)
    expect(comparerVersions('0.2', '0.2.0')).toBe(0)
    expect(comparerVersions('0.1.9', 'v0.2')).toBe(-1)
    expect(comparerVersions('dev', '0.2')).toBeNull()
  })

  it('« Plus tard » tient 30 minutes', () => {
    reporter(1000)
    expect(estReporte(1000 + RAPPEL_MS - 1)).toBe(true)
    expect(estReporte(1000 + RAPPEL_MS)).toBe(false)
  })
})

describe('actualiser sans perdre la saisie', () => {
  it('garde ce que les écrans inscrivent, recharge, puis le leur rend une fois', () => {
    const retirer = registerBeforeReload('brouillon', () => ({ texte: 'en cours' }))
    registerBeforeReload('vide', () => undefined)
    registerBeforeReload('casse', () => { throw new Error('x') })
    const recharger = vi.fn()
    actualiser({ recharger })
    expect(recharger).toHaveBeenCalledOnce()
    retirer()

    const restaurer = vi.fn()
    registerAfterReload('brouillon', restaurer)
    expect(restaurer).toHaveBeenCalledWith({ texte: 'en cours' })
    registerAfterReload('brouillon', restaurer)
    expect(restaurer).toHaveBeenCalledOnce()
    expect(sessionStorage.getItem('cfao.maj-etat')).toBeNull()
  })
})

describe('MiseAJourDisponible', () => {
  it('même build : rien ne s’affiche', async () => {
    await monter({ faireFetch: reponse({ module: 'portail', build: 'b1' }) })
    expect(hote.textContent).toBe('')
  })

  it('échec de lecture (réseau, 404, HTML) : silence', async () => {
    await monter({ faireFetch: vi.fn().mockRejectedValue(new Error('réseau')) })
    expect(hote.textContent).toBe('')
    act(() => racine.unmount())
    await monter({ faireFetch: reponse({}, false) })
    expect(hote.textContent).toBe('')
    act(() => racine.unmount())
    await monter({ faireFetch: vi.fn().mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError() } }) })
    expect(hote.textContent).toBe('')
  })

  it('nouveau build : bandeau non bloquant avec version, rappel et deux choix', async () => {
    const recharger = vi.fn()
    await monter({ faireFetch: reponse({ module: 'portail', version: 'v0.2.6', build: 'b2' }), recharger })
    const bandeau = hote.querySelector('[role="status"]')
    expect(bandeau.textContent).toContain('Une nouvelle version est disponible')
    expect(bandeau.textContent).toContain('Version v0.2.6')
    expect(bandeau.textContent).toContain('30 minutes')
    expect(hote.querySelector('[role="alertdialog"]')).toBeNull()
    act(() => bouton('Actualiser maintenant').click())
    expect(recharger).toHaveBeenCalledOnce()
  })

  it('« Plus tard » ferme le bandeau et le fait taire 30 minutes', async () => {
    const faireFetch = reponse({ build: 'b2' })
    await monter({ faireFetch })
    act(() => bouton('Plus tard').click())
    expect(hote.textContent).toBe('')
    expect(estReporte()).toBe(true)
    act(() => racine.unmount())
    await monter({ faireFetch })
    expect(hote.textContent).toBe('')
  })

  it('version critique : modale sans « Plus tard », même après un report', async () => {
    reporter()
    await monter({ faireFetch: reponse({ build: 'b2', critical: true }) })
    const modale = hote.querySelector('[role="alertdialog"]')
    expect(modale.textContent).toContain('Mise à jour nécessaire')
    expect(bouton('Plus tard')).toBeUndefined()
    expect(bouton('Actualiser maintenant')).toBeDefined()
  })

  it('relit version.json à intervalle et au retour sur l’onglet (au plus une fois par minute)', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    const faireFetch = reponse({ build: 'b1' })
    await monter({ faireFetch, intervalle: 5 * 60_000 })
    expect(faireFetch).toHaveBeenCalledTimes(1)
    await act(async () => { vi.advanceTimersByTime(5 * 60_000) })
    expect(faireFetch).toHaveBeenCalledTimes(2)
    // Retour immédiat : trop tôt.
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(faireFetch).toHaveBeenCalledTimes(2)
    vi.setSystemTime(Date.now() + 61_000)
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(faireFetch).toHaveBeenCalledTimes(3)
    await act(async () => { window.dispatchEvent(new Event('vite:preloadError')) })
    expect(faireFetch).toHaveBeenCalledTimes(4)
  })

  it('anglais et portugais', async () => {
    await monter({ faireFetch: reponse({ build: 'b2' }) }, 'en')
    expect(hote.textContent).toContain('A new version is available')
    expect(bouton('Later')).toBeDefined()
    act(() => racine.unmount())
    await monter({ faireFetch: reponse({ build: 'b2' }) }, 'pt')
    expect(hote.textContent).toContain('Uma nova versão está disponível')
    expect(bouton('Mais tarde')).toBeDefined()
  })

  it('code hors build (serveur de dev) : aucune lecture', async () => {
    const faireFetch = reponse({ build: 'b2' })
    hote = document.createElement('div')
    racine = createRoot(hote)
    await act(async () => {
      racine.render(
        <LocaleContext.Provider value={{ locale: 'fr', setLocale() {} }}>
          <MiseAJourDisponible locale={{ ...LOCALE, build: '' }} faireFetch={faireFetch} />
        </LocaleContext.Provider>,
      )
    })
    expect(faireFetch).not.toHaveBeenCalled()
  })
})
