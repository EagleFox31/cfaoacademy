import { describe, expect, it } from 'vitest'
import { valeursDrapeaux } from './diapositives'
import { formeBilan, paragrapheBilan } from './remarquesSession'

const rubriques = [
  { cle: 'contexte', texte: 'Contexte par défaut.' },
  { cle: 'resultats', texte: 'Résultats par défaut.' },
  { cle: 'vigilance', texte: '' },
  { cle: 'suites', texte: 'Suites par défaut.' },
]

describe('bilan en un paragraphe', () => {
  it('est la forme par defaut', () => {
    expect(formeBilan({})).toBe('paragraphe')
    expect(formeBilan({ 'bilan.forme': 'rubriques' })).toBe('rubriques')
  })

  it('reprend les rubriques, saisies comprises, tant qu’il n’est pas ecrit', () => {
    const textes = { 'bilan.resultats': 'Résultats retouchés.' }
    expect(paragrapheBilan(textes, rubriques))
      .toBe('Contexte par défaut. Résultats retouchés. Suites par défaut.')
  })

  it('garde le texte ecrit, meme vide', () => {
    expect(paragrapheBilan({ 'bilan.paragraphe': 'Un seul texte.' }, rubriques)).toBe('Un seul texte.')
    expect(paragrapheBilan({ 'bilan.paragraphe': '' }, rubriques)).toBe('')
  })

  it('remplit la premiere rubrique et retire intertitres et autres drapeaux', () => {
    const b = { textes: { 'bilan.paragraphe': 'Le bilan de la session.' } }
    const v = valeursDrapeaux(b, null, {}, { cle: 'bilan' }, {})
    expect(v['{bilan_contexte}']).toBe('Le bilan de la session.')
    expect(v['@retirer_paragraphes']).toEqual(expect.arrayContaining([
      'Contexte et appréciation', 'Suites à donner', '{bilan_resultats}', '{bilan_suites}']))
  })

  it('laisse les quatre rubriques a qui les choisit', () => {
    const b = { textes: { 'bilan.forme': 'rubriques', 'bilan.suites': 'Suites.' } }
    const v = valeursDrapeaux(b, null, {}, { cle: 'bilan' }, {})
    expect(v['{bilan_suites}']).toBe('Suites.')
    expect(v['@retirer_paragraphes']).toBeUndefined()
  })
})
