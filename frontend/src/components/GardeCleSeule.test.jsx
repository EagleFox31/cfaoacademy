// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import GardeCleSeule from './GardeCleSeule.jsx'
import useAuth from '../hooks/useAuth.js'

vi.mock('../hooks/useAuth.js', () => ({ default: vi.fn() }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

function Lieu() {
  return <p data-testid="lieu">{useLocation().pathname}</p>
}

let racine
let hote

async function afficher(chemin, roles) {
  useAuth.mockReturnValue({ user: roles ? { id: 'u1', roles } : null })
  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
  await act(async () => {
    racine.render(
      <MemoryRouter initialEntries={[chemin]}>
        <GardeCleSeule><Lieu /></GardeCleSeule>
      </MemoryRouter>,
    )
  })
  return hote.querySelector('[data-testid="lieu"]')?.textContent
}

afterEach(async () => {
  await act(async () => racine.unmount())
  hote.remove()
})

describe('GardeCleSeule', () => {
  it.each(['center_director', 'center_assistant', 'training_coordinator'])(
    '%s : ramené du portail vers la clé',
    async (role) => {
      expect(await afficher('/portail', [role])).toBe('/portail/cle-repartition')
    },
  )

  it('ramène aussi depuis une autre page du portail', async () => {
    expect(await afficher('/portail/assistance', ['center_director'])).toBe('/portail/cle-repartition')
  })

  it('laisse les sous-vues de la clé', async () => {
    expect(await afficher('/portail/cle-repartition/country', ['center_assistant'])).toBe('/portail/cle-repartition/country')
  })

  it('laisse les pages publiques', async () => {
    expect(await afficher('/formations', ['center_director'])).toBe('/formations')
  })

  it('ne touche pas aux autres rôles', async () => {
    expect(await afficher('/portail', ['dps'])).toBe('/portail')
    await act(async () => racine.unmount())
    hote.remove()
    expect(await afficher('/portail', ['center_director', 'superadmin'])).toBe('/portail')
  })

  it('ne touche pas un visiteur non connecté', async () => {
    expect(await afficher('/portail', null)).toBe('/portail')
  })
})
