// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import RedirectionExterne from './RedirectionExterne.jsx'
import { adresseComptesRendus } from '../utils/urlComptesRendus.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

describe('adresseComptesRendus', () => {
  it('reprend le chemin, la query et l\'ancre sur la base du module', () => {
    const lieu = { pathname: '/portail/compte-rendu/nouveau', search: '?session=ses-1', hash: '#bilan' }
    expect(adresseComptesRendus(lieu, 'http://cr.exemple.test'))
      .toBe('http://cr.exemple.test/portail/compte-rendu/nouveau?session=ses-1#bilan')
  })

  it('ignore la barre finale de la base', () => {
    expect(adresseComptesRendus({ pathname: '/portail/compte-rendu/en-cours' }, 'http://cr.exemple.test/'))
      .toBe('http://cr.exemple.test/portail/compte-rendu/en-cours')
  })
})

describe('RedirectionExterne', () => {
  let racine
  afterEach(() => { act(() => racine?.unmount()) })

  it('renvoie vers le module en gardant la query', () => {
    vi.stubEnv('VITE_CR_URL', 'http://cr.exemple.test')
    const aller = vi.fn()
    const conteneur = document.createElement('div')
    racine = createRoot(conteneur)
    act(() => {
      racine.render(
        <MemoryRouter initialEntries={['/portail/compte-rendu/nouveau?session=ses-1']}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <RedirectionExterne aller={aller} />
        </MemoryRouter>,
      )
    })
    expect(aller).toHaveBeenCalledWith(
      'http://cr.exemple.test/portail/compte-rendu/nouveau?session=ses-1')
    vi.unstubAllEnvs()
  })
})
