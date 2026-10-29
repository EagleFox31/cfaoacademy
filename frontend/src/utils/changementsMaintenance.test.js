import { describe, expect, it } from 'vitest'
import { changementsVisibles } from './changementsMaintenance'

const CHANGEMENTS = [
  { texte: 'Les graphiques de l’aperçu montrent les vrais chiffres.' },
  { texte: 'Nouveau journal des erreurs.', pour: ['superadmin'] },
  { texte: '  Le bouton retour ramène à la liste d’origine.  ' },
]

describe('changementsVisibles', () => {
  it('cache au formateur les changements réservés', () => {
    expect(changementsVisibles(CHANGEMENTS, ['trainer'])).toEqual([
      'Les graphiques de l’aperçu montrent les vrais chiffres.',
      'Le bouton retour ramène à la liste d’origine.',
    ])
  })

  it('montre tout au superadmin', () => {
    expect(changementsVisibles(CHANGEMENTS, ['superadmin'])).toHaveLength(3)
  })

  it('sans rôle connu, seuls les changements communs', () => {
    expect(changementsVisibles(CHANGEMENTS, undefined)).toHaveLength(2)
  })

  it('ignore une liste absente ou des entrées mal formées', () => {
    expect(changementsVisibles(undefined, ['superadmin'])).toEqual([])
    expect(changementsVisibles([null, { texte: '' }, { pour: ['x'] }, 'texte'], [])).toEqual([])
  })
})
