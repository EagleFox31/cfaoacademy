/* @vitest-environment jsdom */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const etat = vi.hoisted(() => ({ user: null }))

vi.mock('../components/Nav', () => ({ default: () => null }))
vi.mock('../components/Footer', () => ({ default: () => null }))
vi.mock('../components/PortalDemoBar', () => ({ default: () => null }))
vi.mock('../hooks/useSiteEffects', () => ({ default: () => {} }))
vi.mock('../hooks/usePortalReveal', () => ({ default: () => {} }))
vi.mock('../hooks/usePortalBackground', () => ({ default: () => {} }))
vi.mock('../hooks/useAuth.js', () => ({ default: () => ({ user: etat.user, status: 'ready' }) }))
vi.mock('../hooks/useAuth', () => ({ default: () => ({ user: etat.user, status: 'ready' }) }))
vi.mock('../lib/auth.js', () => ({ OIDC_ACTIF: true }))

const { LocaleProvider } = await import('../context/LocaleProvider.jsx')
const { api } = await import('../lib/api')
const { default: MesPropositions } = await import('./MesPropositions.jsx')
const { default: fr } = await import('../i18n/locales/fr/portal.json')

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const DIRECTEUR = { id: 'u-dir', roles: ['center_director'], firstName: 'Laurent' }
const ENVOYEE = {
  id: 'a', created_at: '2026-11-20T10:00:00Z', role_vu: 'trainer', type: 'ajout_kpi', section: '',
  message: 'Taux de remplissage.', statut: 'nouvelle',
}
const PLANIFIEE = {
  ...ENVOYEE, id: 'b', type: '', section: 'Devis', message: 'Total par filiale.', statut: 'planifiee',
  lue_le: '2026-11-21T08:00:00Z', planifiee_le: '2026-11-22T08:00:00Z', etape_le: '2026-11-22T08:00:00Z',
  echeance: '2026-12-15', reponse_equipe: 'Dans la prochaine version.',
}
const NON_RETENUE = {
  ...ENVOYEE, id: 'c', statut: 'non_retenue', lue_le: '2026-11-21T08:00:00Z',
  non_retenue_le: '2026-11-23T08:00:00Z', etape_le: '2026-11-23T08:00:00Z', reponse_equipe: 'Déjà dans le tableau de bord.',
}

let racine
let hote

async function rendre() {
  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
  await act(async () => {
    racine.render(
      <LocaleProvider>
        <MemoryRouter initialEntries={['/portail/mes-propositions']}>
          <Routes>
            <Route path="/portail/mes-propositions" element={<MesPropositions />} />
            <Route path="/portail" element={<p>accueil</p>} />
            <Route path="/login" element={<p>connexion</p>} />
          </Routes>
        </MemoryRouter>
      </LocaleProvider>,
    )
  })
  await act(async () => {})
}

const lignes = groupe => [...hote.querySelectorAll(`[data-testid="mes-prop-groupe-${groupe}"] [data-testid="mes-prop-ligne"]`)]
const titre = groupe => hote.querySelector(`[data-testid="mes-prop-groupe-${groupe}"] h2`)

beforeEach(() => {
  localStorage.clear()
  etat.user = DIRECTEUR
})

afterEach(() => {
  act(() => racine?.unmount())
  hote?.remove()
  vi.restoreAllMocks()
})

describe('page « Mes propositions »', () => {
  it('deux tableaux : en cours et terminées, avec leur nombre', async () => {
    vi.spyOn(api.suggestions, 'miennes').mockResolvedValue([PLANIFIEE, ENVOYEE, NON_RETENUE])
    await rendre()
    expect(titre('en_cours').textContent).toBe(`${fr.mes_prop_groupe_en_cours}2`)
    expect(titre('terminees').textContent).toBe(`${fr.mes_prop_groupe_terminees}1`)
    const [planifiee, envoyee] = lignes('en_cours')
    expect(planifiee.querySelector('.mes-prop-quoi').textContent).toBe('Devis')
    expect(planifiee.textContent).toContain('Total par filiale.')
    expect(planifiee.textContent).toContain('Formateur')
    expect(planifiee.querySelector('.mes-propositions-statut').textContent).toBe(fr.proposition_etape_planifiee)
    expect(planifiee.querySelector('.mes-prop-echeance').textContent).toBe('Prévue d’ici le 15 déc. 2026')
    expect(planifiee.querySelector('.mes-prop-reponse').textContent).toBe('Dans la prochaine version.')
    expect(envoyee.querySelector('.mes-prop-reponse').textContent).toBe('—')
    // Changement d'étape non vu : pastille « Nouveau » pendant la visite.
    expect(planifiee.querySelector('.mes-prop-nouveau')).not.toBeNull()
    expect(envoyee.querySelector('.mes-prop-nouveau')).toBeNull()
  })

  it('l’ouvrir vaut lecture : rien de nouveau à la visite suivante', async () => {
    vi.spyOn(api.suggestions, 'miennes').mockResolvedValue([PLANIFIEE])
    await rendre()
    expect(hote.querySelector('.mes-prop-nouveau')).not.toBeNull()
    act(() => racine.unmount())
    hote.remove()
    await rendre()
    expect(hote.querySelector('.mes-prop-nouveau')).toBeNull()
  })

  it('non retenue : le motif est annoncé', async () => {
    vi.spyOn(api.suggestions, 'miennes').mockResolvedValue([NON_RETENUE])
    await rendre()
    // Rien en cours : seul le tableau des terminées est montré.
    expect(titre('en_cours')).toBeNull()
    const [ligne] = lignes('terminees')
    expect(ligne.querySelector('.mes-prop-reponse-titre').textContent).toBe(fr.mes_prop_motif)
    expect(ligne.querySelector('.mes-prop-reponse p').textContent).toBe('Déjà dans le tableau de bord.')
  })

  it('aucune proposition : le dit', async () => {
    vi.spyOn(api.suggestions, 'miennes').mockResolvedValue([])
    await rendre()
    expect(hote.querySelector('[data-testid="mes-prop-aucune"]').textContent).toBe(fr.mes_prop_aucune)
  })

  it('indisponible : le dit, sans rien inventer', async () => {
    vi.spyOn(api.suggestions, 'miennes').mockRejectedValue(new Error('x'))
    await rendre()
    expect(hote.querySelector('[role="alert"]').textContent).toBe(fr.mes_prop_indispo)
    expect(hote.querySelectorAll('[data-testid="mes-prop-ligne"]')).toHaveLength(0)
  })

  it('profil sans propositions : renvoyé au portail, sans appel', async () => {
    etat.user = { id: 'u-f', roles: ['trainer'] }
    const miennes = vi.spyOn(api.suggestions, 'miennes')
    await rendre()
    expect(hote.textContent).toBe('accueil')
    expect(miennes).not.toHaveBeenCalled()
  })
})
