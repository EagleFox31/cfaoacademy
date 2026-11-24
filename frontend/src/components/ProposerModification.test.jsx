// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../context/LocaleProvider.jsx'
import { api, ApiError } from '../lib/api'
import ProposerModification, { cheminPage, libelleToutePage, partiesDeLaPage, peutProposer, retenirOrigine } from './ProposerModification.jsx'
import { libelleType, typeDepuisSaisie, typesLibres } from '../utils/typesProposition.js'
import fr from '../i18n/locales/fr/portal.json'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let racine
let conteneur
let page

function saisir(zone, valeur) {
  const proto = zone instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
  setter.call(zone, valeur)
  zone.dispatchEvent(new Event('input', { bubbles: true }))
}

async function monterEtOuvrir() {
  conteneur = document.createElement('div')
  document.body.appendChild(conteneur)
  racine = createRoot(conteneur)
  await act(async () => {
    racine.render(<LocaleProvider><ProposerModification role="trainer" /></LocaleProvider>)
  })
  await act(async () => { conteneur.querySelector('.portal-apercu-proposer').click() })
  return conteneur.querySelector('[role="dialog"]')
}

async function envoyer(dialogue, texte) {
  await act(async () => { saisir(dialogue.querySelector('textarea'), texte) })
  await act(async () => { dialogue.querySelector('form').requestSubmit() })
}

beforeEach(() => {
  vi.spyOn(api.suggestions, 'miennes').mockResolvedValue([])
  page = document.createElement('main')
  page.innerHTML = '<h2>Mes sessions</h2><h2>  Mes   sessions </h2><h2>Mes évaluations</h2><h2> </h2>'
  document.body.appendChild(page)
})

afterEach(() => {
  act(() => racine?.unmount())
  conteneur?.remove()
  page.remove()
  vi.restoreAllMocks()
  sessionStorage.clear()
})

describe('vignette d’origine → page', () => {
  const fenetre = pathname => ({
    location: { href: `http://x${pathname}`, origin: 'http://x', pathname },
    sessionStorage,
  })

  it('le clic sur une vignette est retenu pour la page où elle mène', () => {
    page.innerHTML = '<div class="portal-card-anchor"><h3>Devis des filiales 2027</h3><a href="/portail/cle-repartition/country?annee=2027">Voir</a></div>'
    retenirOrigine({ target: page.querySelector('a') }, fenetre('/portail'))
    document.body.insertAdjacentHTML('beforeend', '<h1 id="titre-test">Devis</h1>')
    expect(libelleToutePage(fr, document, fenetre('/portail/cle-repartition/country')))
      .toBe('Vignette « Devis des filiales 2027 » → page « Devis »')
    expect(libelleToutePage(fr, document, fenetre('/portail/autre'))).toBe('Toute la page « Devis »')
    document.getElementById('titre-test').remove()
  })

  it('sans titre de page ni vignette : rien d’inventé', () => {
    retenirOrigine({ target: page }, fenetre('/portail'))
    expect(sessionStorage.length).toBe(0)
    expect(libelleToutePage(fr, document, fenetre('/portail'))).toBe('')
  })

  it('le contexte est choisi par défaut et part avec la proposition', async () => {
    const creer = vi.spyOn(api.suggestions, 'creer').mockResolvedValue({ id: 'x' })
    sessionStorage.setItem('cfao-apercu-origine', JSON.stringify({ chemin: window.location.pathname, vignette: 'Devis des filiales 2027' }))
    page.insertAdjacentHTML('afterbegin', '<h1>Devis</h1>')
    const dialogue = await monterEtOuvrir()
    const choix = dialogue.querySelector('select')
    expect(choix.options[0].textContent).toBe('Vignette « Devis des filiales 2027 » → page « Devis »')
    expect(choix.value).toBe(choix.options[0].textContent)
    await envoyer(dialogue, 'Ajouter le total par filiale.')
    expect(creer.mock.calls[0][0].section).toBe('Vignette « Devis des filiales 2027 » → page « Devis »')
  })
})

describe('règles', () => {
  it('seuls le directeur du centre et le super admin peuvent proposer', () => {
    expect(peutProposer(['center_director'])).toBe(true)
    expect(peutProposer(['superadmin'])).toBe(true)
    expect(peutProposer(['training_coordinator', 'trainer'])).toBe(false)
    expect(peutProposer(undefined)).toBe(false)
  })

  it('le chemin envoyé ne garde que les caractères acceptés', () => {
    expect(cheminPage('/portail/formateur')).toBe('/portail/formateur')
    expect(cheminPage('/a b?c<d>')).toBe('/a-b-c-d-')
    expect(cheminPage('')).toBe('/')
    expect(cheminPage('/' + 'x'.repeat(300))).toHaveLength(200)
  })

  it('les parties viennent des titres de la page, sans doublon ni vide', () => {
    expect(partiesDeLaPage(document)).toEqual(['Mes sessions', 'Mes évaluations'])
  })
})

describe('envoi', () => {
  it('envoie le portail, la page, la partie choisie, le texte et la langue', async () => {
    const creer = vi.spyOn(api.suggestions, 'creer').mockResolvedValue({ id: 'x' })
    const dialogue = await monterEtOuvrir()
    expect(dialogue.textContent).toContain('Formateur')
    const select = dialogue.querySelector('select')
    expect([...select.options].map(o => o.textContent)).toEqual(['Toute la page', 'Mes sessions', 'Mes évaluations'])
    await act(async () => {
      select.value = 'Mes évaluations'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await envoyer(dialogue, '  Mettre les sessions de la semaine en premier.  ')
    expect(creer).toHaveBeenCalledWith({
      role_vu: 'trainer',
      chemin: cheminPage(window.location.pathname),
      section: 'Mes évaluations',
      type: '',
      message: 'Mettre les sessions de la semaine en premier.',
      langue: 'fr',
    })
    expect(dialogue.querySelector('[role="status"]').textContent).toContain('Proposition envoyée')
    expect(dialogue.querySelector('textarea').value).toBe('')
  })

  it('type choisi dans la liste : le code part, l’exemple s’adapte', async () => {
    const creer = vi.spyOn(api.suggestions, 'creer').mockResolvedValue({ id: 'x' })
    const dialogue = await monterEtOuvrir()
    const type = dialogue.querySelector('input[role="combobox"]')
    await act(async () => { type.click() })
    const options = [...dialogue.querySelectorAll('[role="option"]')].map(o => o.textContent)
    expect(options).toHaveLength(12)
    expect(options).toContain('Ajouter un indicateur (KPI)')
    expect(options).toContain('Retirer une section')
    await act(async () => { saisir(type, 'indicateur') })
    expect([...dialogue.querySelectorAll('[role="option"]')].map(o => o.textContent)).toEqual(['Ajouter un indicateur (KPI)'])
    await act(async () => { saisir(type, 'ajouter un indicateur (kpi)') })
    expect(dialogue.querySelector('textarea').placeholder).toBe(fr.proposition_exemple_ajout_kpi)
    await envoyer(dialogue, 'Le taux de remplissage du mois.')
    expect(creer.mock.calls[0][0].type).toBe('ajout_kpi')
    expect(type.value).toBe('')
  })

  it('liste des types au clavier et à la souris, Échap ferme la liste sans fermer le panneau', async () => {
    const dialogue = await monterEtOuvrir()
    const type = dialogue.querySelector('input[role="combobox"]')
    const touche = key => act(async () => { type.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })) })
    await touche('ArrowDown')
    expect(type.getAttribute('aria-expanded')).toBe('true')
    await touche('ArrowDown')
    expect(type.getAttribute('aria-activedescendant')).toBe(dialogue.querySelectorAll('[role="option"]')[1].id)
    await touche('Enter')
    expect(type.value).toBe('Il manque une information')
    expect(dialogue.querySelector('[role="listbox"]')).toBeNull()
    await act(async () => { dialogue.querySelector('.portal-apercu-choix-fleche').click() })
    await act(async () => { dialogue.querySelectorAll('[role="option"]')[4].click() })
    expect(type.value).toBe('Changer une couleur')
    await act(async () => { type.click() })
    await touche('Escape')
    expect(dialogue.querySelector('[role="listbox"]')).toBeNull()
    expect(conteneur.querySelector('[role="dialog"]')).not.toBeNull()
  })

  it('type écrit à la main : le texte libre part tel quel', async () => {
    const creer = vi.spyOn(api.suggestions, 'creer').mockResolvedValue({ id: 'x' })
    const dialogue = await monterEtOuvrir()
    await act(async () => { saisir(dialogue.querySelector('input[role="combobox"]'), '  Changer   le pied de page ') })
    expect(dialogue.querySelector('textarea').placeholder).toBe(fr.apercu_proposer_exemple)
    await envoyer(dialogue, 'Ajouter le numéro du support.')
    expect(creer.mock.calls[0][0].type).toBe('Changer le pied de page')
  })

  it('texte trop court : bouton Envoyer désactivé, rien ne part', async () => {
    const creer = vi.spyOn(api.suggestions, 'creer')
    const dialogue = await monterEtOuvrir()
    await act(async () => { saisir(dialogue.querySelector('textarea'), 'court') })
    expect(dialogue.querySelector('button[type="submit"]').disabled).toBe(true)
    await act(async () => { dialogue.querySelector('form').requestSubmit() })
    expect(creer).not.toHaveBeenCalled()
  })

  it.each([
    [new ApiError(403, 'refus'), 'ne peut pas proposer'],
    [new ApiError(429, 'trop'), 'Trop de propositions'],
    [new TypeError('réseau'), 'Votre texte est conservé'],
  ])('échec %#: message clair, texte conservé en cas d’erreur', async (erreur, attendu) => {
    vi.spyOn(api.suggestions, 'creer').mockRejectedValue(erreur)
    const dialogue = await monterEtOuvrir()
    await envoyer(dialogue, 'Un texte assez long pour partir.')
    expect(dialogue.querySelector('[role="status"]').textContent).toContain(attendu)
    expect(dialogue.querySelector('textarea').value).toBe('Un texte assez long pour partir.')
  })

  it('vos propositions : suivi affiché, types libres reproposés, nouvelle en tête', async () => {
    api.suggestions.miennes.mockResolvedValue([
      { id: 'a', created_at: '2026-11-20T10:00:00Z', type: 'ajout_kpi', message: 'Taux de remplissage.', statut: 'planifiee', echeance: '2026-12-15' },
      { id: 'b', created_at: '2026-11-21T10:00:00Z', type: 'Pied de page', message: 'Numéro du support.', statut: 'nouvelle' },
      { id: 'c', created_at: '2026-11-22T10:00:00Z', type: '', section: 'Mes sessions', message: 'Trier par date.', statut: 'nouvelle' },
    ])
    vi.spyOn(api.suggestions, 'creer').mockResolvedValue(
      { id: 'd', created_at: '2026-11-24T10:00:00Z', type: 'couleur', message: 'Reporté en rouge.', statut: 'nouvelle' })
    const dialogue = await monterEtOuvrir()
    const liste = () => [...dialogue.querySelectorAll('[data-testid="mes-propositions"] li')].map(li => li.textContent)
    expect(liste()).toHaveLength(3)
    expect(liste()[0]).toContain('Ajouter un indicateur (KPI)')
    expect(liste()[0]).toContain('Prévue d’ici le 15')
    expect(liste()[1]).toContain('Pied de page')
    expect(liste()[1]).toContain('Envoyée')
    expect(liste()[2]).toContain('Mes sessions')
    await act(async () => { dialogue.querySelector('input[role="combobox"]').click() })
    expect([...dialogue.querySelectorAll('[role="option"]')].map(o => o.textContent)).toContain('Pied de page')
    await envoyer(dialogue, 'Mettre Reporté en rouge.')
    expect(liste()).toHaveLength(4)
    expect(liste()[0]).toContain('Changer une couleur')
  })

  it('vos propositions indisponibles : rien n’est affiché, le formulaire marche', async () => {
    api.suggestions.miennes.mockRejectedValue(new ApiError(403, 'refus'))
    const creer = vi.spyOn(api.suggestions, 'creer').mockResolvedValue({ id: 'x' })
    const dialogue = await monterEtOuvrir()
    expect(dialogue.querySelector('[data-testid="mes-propositions"]')).toBeNull()
    await envoyer(dialogue, 'Un texte assez long pour partir.')
    expect(creer).toHaveBeenCalled()
  })

  it('Échap ferme le panneau et rend la main au bouton', async () => {
    const dialogue = await monterEtOuvrir()
    await act(async () => {
      dialogue.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(conteneur.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(conteneur.querySelector('.portal-apercu-proposer'))
  })
})

describe('types de proposition', () => {
  it('libellé du type de la liste, sinon texte libre tel quel', () => {
    expect(libelleType('ajout_section', fr)).toBe('Ajouter une section')
    expect(libelleType('  Pied   de page ', fr)).toBe('Pied de page')
  })

  it('saisie : code si c’est un libellé de la liste (casse et espaces ignorés), sinon texte limité à 60', () => {
    expect(typeDepuisSaisie(' changer  UNE couleur ', fr)).toBe('couleur')
    expect(typeDepuisSaisie('', fr)).toBe('')
    expect(typeDepuisSaisie('x'.repeat(80), fr)).toHaveLength(60)
  })

  it('types libres déjà utilisés, sans doublon ni type de la liste', () => {
    expect(typesLibres([{ type: 'Pied de page' }, { type: 'pied de page' }, { type: 'ajout_kpi' }, { type: '' }, null]))
      .toEqual(['Pied de page'])
  })
})
