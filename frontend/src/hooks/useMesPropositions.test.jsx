// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../context/LocaleProvider.jsx'
import { api } from '../lib/api'
import { UserMenuItems } from '../components/UserMenu.jsx'
import { PROPOSITION_CREEE } from '../utils/typesProposition.js'
import useMesPropositions, { PAGE_MES_PROPOSITIONS, alertesAvecPropositions } from './useMesPropositions.js'
import profil from '../i18n/locales/fr/profile.json'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const DIRECTEUR = { id: 'u-dir', roles: ['center_director'], firstName: 'Laurent' }
const LUE = {
  id: 'a', created_at: '2026-11-20T10:00:00Z', type: 'ajout_kpi', message: 'Taux de remplissage.',
  statut: 'lue', lue_le: '2026-11-21T08:00:00Z', etape_le: '2026-11-21T08:00:00Z',
}
const ENVOYEE = { id: 'b', created_at: '2026-11-21T10:00:00Z', type: '', section: 'Devis', message: 'Total par filiale.', statut: 'nouvelle' }

let racine
let conteneur
let hook

function Banc({ user }) {
  const propositions = useMesPropositions(user)
  hook = propositions
  return <UserMenuItems user={user} notifications={[]} propositions={propositions} />
}

async function monter(user = DIRECTEUR) {
  conteneur = document.createElement('div')
  document.body.appendChild(conteneur)
  racine = createRoot(conteneur)
  await act(async () => {
    racine.render(<MemoryRouter><LocaleProvider><Banc user={user} /></LocaleProvider></MemoryRouter>)
  })
}

function demonter() {
  act(() => racine.unmount())
  conteneur.remove()
}

const entree = () => [...conteneur.querySelectorAll('a, button')].find(b => b.textContent.includes(profil.menu_propositions))
const compteur = () => entree().querySelector('.nav-user-dropdown-count')?.textContent ?? null

beforeEach(() => localStorage.clear())

afterEach(() => {
  act(() => racine?.unmount())
  conteneur?.remove()
  vi.restoreAllMocks()
})

describe('Mes propositions (menu du compte)', () => {
  it('lien vers la page de suivi, avec le nombre de changements d’étape non vus', async () => {
    vi.spyOn(api.suggestions, 'miennes').mockResolvedValue([ENVOYEE, LUE])
    await monter()
    expect(entree().tagName).toBe('A')
    expect(entree().getAttribute('href')).toBe(PAGE_MES_PROPOSITIONS)
    // « Envoyée » n'est pas un changement : seule la proposition lue compte.
    expect(compteur()).toBe('1')
  })

  it('vu : le compteur tombe, et reste à zéro au prochain chargement', async () => {
    vi.spyOn(api.suggestions, 'miennes').mockResolvedValue([ENVOYEE, LUE])
    await monter()
    await act(async () => { hook.marquerVues(hook.nouvelles) })
    expect(compteur()).toBeNull()
    demonter()
    await monter()
    expect(compteur()).toBeNull()
  })

  it('une nouvelle étape après une étape vue : le compteur revient', async () => {
    const miennes = vi.spyOn(api.suggestions, 'miennes').mockResolvedValue([LUE])
    await monter()
    await act(async () => { hook.marquerVues([LUE]) })
    demonter()
    miennes.mockResolvedValue([{ ...LUE, statut: 'planifiee', echeance: '2026-12-15', etape_le: '2026-11-23T09:00:00Z' }])
    await monter()
    expect(compteur()).toBe('1')
  })

  it('vu dans une autre instance (page de suivi) : ce compteur se met à jour', async () => {
    vi.spyOn(api.suggestions, 'miennes').mockResolvedValue([LUE])
    await monter()
    const premier = hook
    const autre = document.createElement('div')
    const racineAutre = createRoot(autre)
    await act(async () => {
      racineAutre.render(<MemoryRouter><LocaleProvider><Banc user={DIRECTEUR} /></LocaleProvider></MemoryRouter>)
    })
    await act(async () => { hook.marquerVues([LUE]) })
    expect(premier).not.toBe(hook)
    expect(compteur()).toBeNull()
    act(() => racineAutre.unmount())
  })

  it('liste indisponible : pas de compteur, rien d’inventé', async () => {
    vi.spyOn(api.suggestions, 'miennes').mockRejectedValue(new Error('x'))
    await monter()
    expect(hook.liste).toBeNull()
    expect(compteur()).toBeNull()
  })

  it('autres profils : ni entrée ni appel au serveur', async () => {
    const miennes = vi.spyOn(api.suggestions, 'miennes')
    await monter({ id: 'u-f', roles: ['trainer'] })
    expect(entree()).toBeUndefined()
    expect(miennes).not.toHaveBeenCalled()
  })

  it('une proposition envoyée recharge la liste', async () => {
    const miennes = vi.spyOn(api.suggestions, 'miennes').mockResolvedValue([])
    await monter()
    await act(async () => { window.dispatchEvent(new Event(PROPOSITION_CREEE)) })
    expect(miennes).toHaveBeenCalledTimes(2)
  })
})

describe('cloche : changements d’étape', () => {
  it('en tête des alertes, libellé de l’étape ; l’ouvrir marque vu et mène au suivi', () => {
    const marquer = vi.fn()
    const voir = vi.fn()
    const longue = { ...LUE, message: 'm'.repeat(120) }
    const alertes = alertesAvecPropositions([{ id: 'x' }], [longue], profil, marquer, voir)
    expect(alertes.map(a => a.id)).toEqual(['proposition-a', 'x'])
    expect(alertes[0].label).toBe(profil.propositions_notif_lue)
    expect(alertes[0].cta).toBe(profil.propositions_notif_vu)
    expect(alertes[0].text).toHaveLength(90)
    alertes[0].onOpen()
    expect(marquer).toHaveBeenCalledWith([longue])
    expect(voir).toHaveBeenCalled()
  })

  it('un libellé par étape', () => {
    const libelle = statut => alertesAvecPropositions([], [{ ...LUE, statut }], profil, vi.fn())[0].label
    expect(libelle('planifiee')).toBe(profil.propositions_notif_planifiee)
    expect(libelle('en_ligne')).toBe(profil.propositions_notif_en_ligne)
    expect(libelle('non_retenue')).toBe(profil.propositions_notif_non_retenue)
  })

  it('page sans cloche ou rien de nouveau : alertes inchangées', () => {
    const page = [{ id: 'x' }]
    expect(alertesAvecPropositions(null, [LUE], profil, vi.fn())).toBeNull()
    expect(alertesAvecPropositions(page, [], profil, vi.fn())).toBe(page)
  })
})
