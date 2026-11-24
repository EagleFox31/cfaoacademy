// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

import VersConnexion from './VersConnexion.jsx'
import { consumeAuthReturnPath, memoriserRetour } from '../lib/auth'

function PageConnexion() {
  const location = useLocation()
  const from = location.state?.from
  return <p data-testid="from">{from ? `${from.pathname}${from.search}${from.hash}` : 'aucune'}</p>
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true

describe('lien profond conservé à la connexion', () => {
  let conteneur
  let racine
  beforeEach(() => {
    sessionStorage.clear()
    conteneur = document.createElement('div')
    document.body.appendChild(conteneur)
    racine = createRoot(conteneur)
  })
  afterEach(() => {
    act(() => racine.unmount())
    conteneur.remove()
  })

  it('la garde emporte la page demandée vers /login', () => {
    act(() => {
      racine.render(
        <MemoryRouter initialEntries={['/portail/supervision/connections?x=1#haut']}>
          <Routes>
            <Route path="/portail/supervision/*" element={<VersConnexion />} />
            <Route path="/login" element={<PageConnexion />} />
          </Routes>
        </MemoryRouter>,
      )
    })
    expect(conteneur.querySelector('[data-testid="from"]').textContent).toBe(
      '/portail/supervision/connections?x=1#haut',
    )
  })

  it('retient un chemin interne et le rend une seule fois', () => {
    memoriserRetour('/portail/supervision')
    expect(consumeAuthReturnPath()).toBe('/portail/supervision')
    expect(consumeAuthReturnPath()).toBe('/')
  })

  it.each([null, '', '/', '/login', '/callback?code=x', '//evil.example', 'https://evil.example/'])(
    'ignore %s',
    (chemin) => {
      memoriserRetour(chemin)
      expect(consumeAuthReturnPath()).toBe('/')
    },
  )
})
