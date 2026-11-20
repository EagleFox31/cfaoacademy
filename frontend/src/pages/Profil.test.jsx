/* @vitest-environment jsdom */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

const etat = vi.hoisted(() => ({ user: null, myTrainer: null }))

vi.mock('../components/SitePageLayout.jsx', () => ({ default: ({ children }) => <div>{children}</div> }))
vi.mock('../components/ProfileAvatar.jsx', () => ({ default: () => null }))
vi.mock('../hooks/useAuth.js', () => ({ default: () => ({ user: etat.user, status: 'ready' }) }))
vi.mock('../lib/auth.js', () => ({ OIDC_ACTIF: true, changePassword: vi.fn() }))
vi.mock('../lib/planningApi.js', () => ({ planningApi: { myTrainer: () => etat.myTrainer() } }))

import { LocaleProvider } from '../context/LocaleProvider.jsx'
import Profil from './Profil.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const FORMATEUR = { firstName: 'Eugène', lastName: 'EBENE', username: 'eebene', roles: ['trainer'] }

let root
let host
async function rendre() {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => { root.render(<LocaleProvider><MemoryRouter><Profil /></MemoryRouter></LocaleProvider>) })
  await act(async () => {})
  return host
}

/** Valeur affichée en face d'un libellé de la rubrique « Mon compte ». */
function valeur(el, label) {
  const row = [...el.querySelectorAll('.profile-row')].find(r => r.querySelector('dt')?.textContent === label)
  return row?.querySelector('dd')
}

afterEach(() => {
  act(() => root?.unmount())
  host?.remove()
})

describe('Profil — fiche du formateur', () => {
  it('affiche le pays et les marques de sa fiche du planning, avec les logos', async () => {
    etat.user = FORMATEUR
    etat.myTrainer = () => Promise.resolve({ linked: true, trainer: {
      name: 'Eugène EBENE',
      country: { code: 'cmr', label: 'Cameroun' },
      brands: [{ code: 'toyota', label: 'Toyota' }, { code: 'omoda-jaecoo', label: 'Omoda & Jaecoo' }],
    } })
    const el = await rendre()
    expect(valeur(el, 'Mon pays').textContent).toBe('Cameroun')
    const marques = valeur(el, 'Les marques que je forme')
    expect([...marques.querySelectorAll('.profile-brand')].map(b => b.textContent)).toEqual(['Toyota', 'Omoda & Jaecoo'])
    expect(marques.querySelectorAll('img.profile-brand-logo')).toHaveLength(2)
  })

  it('sans fiche reliée : « Non renseigné », rien d\'inventé', async () => {
    etat.user = FORMATEUR
    etat.myTrainer = () => Promise.resolve({ linked: false, trainer: null })
    const el = await rendre()
    expect(valeur(el, 'Mon pays').textContent).toBe('Non renseigné')
    expect(valeur(el, 'Les marques que je forme').textContent).toBe('Non renseigné')
  })

  it('planning injoignable : « Non renseigné »', async () => {
    etat.user = FORMATEUR
    etat.myTrainer = () => Promise.reject(new Error('503'))
    const el = await rendre()
    expect(valeur(el, 'Les marques que je forme').textContent).toBe('Non renseigné')
  })

  it('pendant la lecture : « Chargement… »', async () => {
    etat.user = FORMATEUR
    etat.myTrainer = () => new Promise(() => {})
    const el = await rendre()
    expect(valeur(el, 'Mon pays').textContent).toBe('Chargement…')
    expect(valeur(el, 'Les marques que je forme').textContent).toBe('Chargement…')
  })

  it('autre rôle : pas de ligne marques, pas d\'appel au planning', async () => {
    etat.user = { firstName: 'Anne', lastName: 'RH', username: 'arh', roles: ['hr'] }
    etat.myTrainer = vi.fn()
    const el = await rendre()
    expect(valeur(el, 'Les marques que je forme')).toBeUndefined()
    expect(etat.myTrainer).not.toHaveBeenCalled()
  })

  it('le bouton « Changer mon mot de passe » reste actif', async () => {
    etat.user = FORMATEUR
    etat.myTrainer = () => Promise.resolve({ linked: false, trainer: null })
    const el = await rendre()
    const tab = [...el.querySelectorAll('.profile-tab')].find(b => b.textContent === 'Connexion et sécurité')
    await act(async () => { tab.click() })
    const bouton = [...el.querySelectorAll('button.profile-action')].find(b => b.textContent === 'Changer mon mot de passe')
    expect(bouton.disabled).toBe(false)
  })
})
