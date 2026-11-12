// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import GardeCentre from './GardeCentre.jsx'
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
        <GardeCentre><Lieu /></GardeCentre>
      </MemoryRouter>,
    )
  })
  return hote.querySelector('[data-testid="lieu"]')?.textContent
}

async function demonter() {
  await act(async () => racine.unmount())
  hote.remove()
}

afterEach(demonter)

describe('GardeCentre', () => {
  it.each(['center_director', 'center_assistant', 'training_coordinator'])(
    '%s : garde sa vitrine /portail',
    async (role) => {
      expect(await afficher('/portail', [role])).toBe('/portail')
    },
  )

  it('ramène vers la vitrine depuis une autre page du portail', async () => {
    expect(await afficher('/portail/assistance', ['center_director'])).toBe('/portail')
  })

  it('laisse la clé et ses sous-vues', async () => {
    expect(await afficher('/portail/cle-repartition', ['training_coordinator'])).toBe('/portail/cle-repartition')
    await demonter()
    expect(await afficher('/portail/cle-repartition/country', ['center_assistant'])).toBe('/portail/cle-repartition/country')
  })

  it('laisse les pages publiques', async () => {
    expect(await afficher('/formations', ['center_director'])).toBe('/formations')
  })

  it('ne touche pas aux autres rôles', async () => {
    expect(await afficher('/portail/assistance', ['dps'])).toBe('/portail/assistance')
    await demonter()
    expect(await afficher('/portail/assistance', ['center_director', 'superadmin'])).toBe('/portail/assistance')
  })

  it('ne touche pas un visiteur non connecté', async () => {
    expect(await afficher('/portail/assistance', null)).toBe('/portail/assistance')
  })
})
