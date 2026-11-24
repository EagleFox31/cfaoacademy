// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import fr from '../i18n/locales/fr/portal.json'

vi.mock('../lib/auth.js', () => ({ OIDC_ACTIF: true }))

const { api } = await import('../lib/api')
const { default: PropositionsPortails } = await import('./PropositionsPortails.jsx')

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let racine
let conteneur

async function monter() {
  conteneur = document.createElement('div')
  document.body.appendChild(conteneur)
  racine = createRoot(conteneur)
  await act(async () => { racine.render(<PropositionsPortails t={fr} locale="fr" />) })
}

/** Change la valeur d'un champ contrôlé par React (setter natif + événement). */
async function saisir(champ, valeur) {
  const proto = Object.getPrototypeOf(champ)
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(champ, valeur)
  await act(async () => { champ.dispatchEvent(new Event('input', { bubbles: true })) })
}

async function choisir(select, valeur) {
  select.value = valeur
  await act(async () => { select.dispatchEvent(new Event('change', { bubbles: true })) })
}

afterEach(() => {
  act(() => racine?.unmount())
  conteneur?.remove()
  vi.restoreAllMocks()
})

const LIGNE = {
  id: 's1',
  created_at: '2026-11-24T09:00:00Z',
  role_vu: 'trainer',
  chemin: '/portail',
  section: '',
  message: 'Mettre les sessions de la semaine en premier.',
  langue: 'fr',
  auteur_nom: 'Directeur Test',
  statut: 'nouvelle',
}

describe('PropositionsPortails', () => {
  it('aucune proposition : le dit', async () => {
    vi.spyOn(api.suggestions, 'lister').mockResolvedValue({ results: [], next: null })
    await monter()
    expect(conteneur.querySelector('[data-testid="suggestions-vide"]').textContent).toBe(fr.sa_suggestions_vide)
  })

  it('liste les propositions avec leur étape', async () => {
    vi.spyOn(api.suggestions, 'lister').mockResolvedValue({ results: [LIGNE], next: null })
    await monter()
    const ligne = conteneur.querySelector('[data-testid="suggestions-liste"] tbody tr')
    expect(ligne.textContent).toContain('Directeur Test')
    expect(ligne.textContent).toContain('Formateur')
    expect(ligne.textContent).toContain('Toute la page')
    expect(ligne.textContent).toContain(LIGNE.message)
    expect(ligne.querySelector('.mes-propositions-statut').textContent).toBe(fr.proposition_etape_nouvelle)
  })

  it('Planifiée : date prévue exigée, puis envoyée avec le mot pour l’auteur', async () => {
    vi.spyOn(api.suggestions, 'lister').mockResolvedValue({ results: [LIGNE], next: null })
    const suivre = vi.spyOn(api.suggestions, 'suivre').mockResolvedValue({
      ...LIGNE, statut: 'planifiee', echeance: '2026-12-15', etape_le: '2026-11-24T10:00:00Z',
    })
    await monter()
    const ligne = conteneur.querySelector('tbody tr')
    await act(async () => { ligne.querySelector('button').click() })
    await choisir(ligne.querySelector('select'), 'planifiee')
    await saisir(ligne.querySelector('textarea'), '  Prévu pour la prochaine version.  ')
    await act(async () => { ligne.querySelector('button[type="submit"]').click() })
    expect(ligne.querySelector('[role="alert"]').textContent).toBe(fr.sa_suggestions_echeance_requise)
    expect(suivre).not.toHaveBeenCalled()
    await saisir(ligne.querySelector('input[type="date"]'), '2026-12-15')
    await act(async () => { ligne.querySelector('button[type="submit"]').click() })
    expect(suivre).toHaveBeenCalledWith('s1', {
      statut: 'planifiee', echeance: '2026-12-15', reponse_equipe: 'Prévu pour la prochaine version.',
    })
    expect(ligne.querySelector('form')).toBeNull()
    expect(ligne.querySelector('.mes-propositions-statut').textContent).toContain('15')
  })

  it('Non retenue : motif exigé ; la ligne passe en terminée', async () => {
    vi.spyOn(api.suggestions, 'lister').mockResolvedValue({ results: [LIGNE], next: null })
    const suivre = vi.spyOn(api.suggestions, 'suivre').mockResolvedValue({ ...LIGNE, statut: 'non_retenue', reponse_equipe: 'Hors périmètre.' })
    await monter()
    const ligne = conteneur.querySelector('tbody tr')
    await act(async () => { ligne.querySelector('button').click() })
    await choisir(ligne.querySelector('select'), 'non_retenue')
    expect(ligne.querySelector('label[for$="-mot"]').textContent).toBe(fr.sa_suggestions_motif)
    expect(ligne.querySelector('input[type="date"]')).toBeNull()
    await act(async () => { ligne.querySelector('button[type="submit"]').click() })
    expect(ligne.querySelector('[role="alert"]').textContent).toBe(fr.sa_suggestions_motif_requis)
    await saisir(ligne.querySelector('textarea'), 'Hors périmètre.')
    await act(async () => { ligne.querySelector('button[type="submit"]').click() })
    expect(suivre).toHaveBeenCalledWith('s1', { statut: 'non_retenue', reponse_equipe: 'Hors périmètre.' })
    expect(ligne.className).toBe('is-terminee')
    expect(ligne.querySelector('.mes-propositions-statut').textContent).toBe(fr.proposition_etape_non_retenue)
  })

  it('Annuler : rien n’est envoyé', async () => {
    vi.spyOn(api.suggestions, 'lister').mockResolvedValue({ results: [LIGNE], next: null })
    const suivre = vi.spyOn(api.suggestions, 'suivre')
    await monter()
    const ligne = conteneur.querySelector('tbody tr')
    await act(async () => { ligne.querySelector('button').click() })
    await choisir(ligne.querySelector('select'), 'lue')
    const annuler = [...ligne.querySelectorAll('button')].find(b => b.textContent === fr.sa_suggestions_annuler)
    await act(async () => { annuler.click() })
    expect(ligne.querySelector('form')).toBeNull()
    expect(suivre).not.toHaveBeenCalled()
  })

  it('colonne Type (libellé ou texte libre) et filtre par type', async () => {
    vi.spyOn(api.suggestions, 'lister').mockResolvedValue({
      results: [
        { ...LIGNE, id: 'a', type: 'ajout_kpi' },
        { ...LIGNE, id: 'b', type: 'Pied de page' },
        { ...LIGNE, id: 'c', type: '' },
      ],
      next: null,
    })
    await monter()
    const lignes = () => [...conteneur.querySelectorAll('[data-testid="suggestions-liste"] tbody tr')].map(tr => tr.textContent)
    expect(lignes()).toHaveLength(3)
    expect(lignes()[0]).toContain('Ajouter un indicateur (KPI)')
    const filtre = conteneur.querySelector('#suggestions-filtre-type')
    expect([...filtre.options].map(o => o.textContent))
      .toEqual([fr.sa_suggestions_tous_types, 'Ajouter un indicateur (KPI)', 'Pied de page'])
    await act(async () => {
      filtre.value = 'Pied de page'
      filtre.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(lignes()).toHaveLength(1)
    expect(lignes()[0]).toContain('Pied de page')
  })

  it('échec du suivi : le formulaire reste ouvert avec un message', async () => {
    vi.spyOn(api.suggestions, 'lister').mockResolvedValue({ results: [LIGNE], next: null })
    vi.spyOn(api.suggestions, 'suivre').mockRejectedValue(new Error('x'))
    await monter()
    const ligne = conteneur.querySelector('tbody tr')
    await act(async () => { ligne.querySelector('button').click() })
    await choisir(ligne.querySelector('select'), 'lue')
    await act(async () => { ligne.querySelector('button[type="submit"]').click() })
    expect(ligne.querySelector('[role="alert"]').textContent).toBe(fr.sa_suggestions_echec)
    expect(ligne.querySelector('form')).not.toBeNull()
    expect(ligne.querySelector('select').value).toBe('lue')
  })

  it('liste indisponible : le dit, sans rien inventer', async () => {
    vi.spyOn(api.suggestions, 'lister').mockRejectedValue(new Error('x'))
    await monter()
    expect(conteneur.textContent).toBe(fr.sa_suggestions_indispo)
  })
})
