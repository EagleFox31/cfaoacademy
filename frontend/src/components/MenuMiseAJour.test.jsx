// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import MenuMiseAJour from './MenuMiseAJour.jsx'
import MiseAJourDisponible from './MiseAJourDisponible.jsx'
import { LocaleContext } from '../context/localeContext.js'
import { publierOffre } from '../lib/miseAJour.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const LOCALE = { module: 'portail', version: '0.2.5', build: 'b1' }
const reponse = (json, ok = true) => vi.fn().mockResolvedValue({ ok, json: async () => json })

let racine
let hote

async function monter(enfants) {
  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
  await act(async () => {
    racine.render(
      <LocaleContext.Provider value={{ locale: 'fr', setLocale() {} }}>{enfants}</LocaleContext.Provider>,
    )
  })
  await act(async () => { await Promise.resolve() })
}

const bouton = (debut) => [...hote.querySelectorAll('button')].find((b) => b.textContent.startsWith(debut))
async function cliquer(b) {
  await act(async () => { b.click() })
  await act(async () => { await Promise.resolve() })
}

beforeEach(() => {
  sessionStorage.clear()
  publierOffre(null)
})
afterEach(() => {
  act(() => racine?.unmount())
  hote?.remove()
  racine = null
})

describe('menu du compte : mises à jour', () => {
  it('à jour : « Rechercher » puis « Vous avez la dernière version »', async () => {
    await monter(<MenuMiseAJour locale={LOCALE} faireFetch={reponse({ module: 'portail', build: 'b1' })} />)
    await cliquer(bouton('Rechercher des mises à jour'))
    expect(hote.querySelector('[role="status"]').textContent).toBe('Vous avez la dernière version.')
  })

  it('lecture impossible : message d’échec, pas de fausse promesse', async () => {
    await monter(<MenuMiseAJour locale={LOCALE} faireFetch={reponse({}, false)} />)
    await cliquer(bouton('Rechercher des mises à jour'))
    expect(hote.textContent).toContain('Recherche impossible pour le moment')
  })

  it('nouvelle version trouvée : l’option devient « Mise à jour disponible · Actualiser »', async () => {
    const recharger = vi.fn()
    await monter(<MenuMiseAJour locale={LOCALE} recharger={recharger}
      faireFetch={reponse({ module: 'portail', build: 'b2' })} />)
    await cliquer(bouton('Rechercher des mises à jour'))
    const option = bouton('Mise à jour disponible')
    expect(option.textContent).toContain('Actualiser')
    await cliquer(option)
    expect(recharger).toHaveBeenCalledOnce()
  })

  it('« Plus tard » sur la barre : la mise à jour reste visible dans le menu', async () => {
    await monter(
      <>
        <MiseAJourDisponible locale={LOCALE} faireFetch={reponse({ module: 'portail', build: 'b2' })} />
        <MenuMiseAJour locale={LOCALE} />
      </>,
    )
    await cliquer(bouton('Plus tard'))
    expect(hote.querySelector('.nv-bandeau')).toBeNull()
    expect(bouton('Mise à jour disponible')).toBeTruthy()
  })
})
