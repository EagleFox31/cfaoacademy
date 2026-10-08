import { describe, expect, it } from 'vitest'
import { avecIntercalaires, valeursDrapeaux, formuleCertification, diapoDe } from './diapositives'
import { ECHOUE, VALIDE } from './certification'

// Une certification G3 fictive : trois modules, un candidat.
const brouillon = {
  type: 'certification',
  codeFormation: 'TS07-G3',
  pays: 'Cameroun',
  modules: [
    { id: 'm1', code: 'G38001', intitule: 'Décharge de la pression' },
    { id: 'm2', code: 'G38002', intitule: 'Dépose et pose du piston' },
    { id: 'm3', code: 'G38003', intitule: 'Dépose de l’arbre à cames' },
  ],
  participants: [{
    id: 'c1', prenom: 'Paul', nom: 'KAMGA',
    notesModules: { m1: 90, m2: 23, m3: 80 },
    elearning: { requis: 136, valides: 112, statut: 'Non finalisé' },
  }],
}
const fiche = { cle: 'fiche-c1' }

describe('fiche individuelle de certification', () => {
  const v = valeursDrapeaux(brouillon, null, {}, fiche, {})

  it('porte la filiale, le total et le pourcentage arrondi', () => {
    expect(v['{filiale}']).toBe('CFAO MOBILITY CAMEROUN')
    expect(v['{total_points}']).toBe('193')
    expect(v['{total_max}']).toBe('300')
    expect(v['{pourcentage}']).toBe('64')
    expect(v['{resultat_pratique}']).toBe(ECHOUE)
  })

  it('repete une ligne par module et rougit les notes sous le seuil', () => {
    const lignes = v['@lignes']['{code_module_1}']
    expect(lignes.map(l => l['{code_module_1}'])).toEqual(['G38001', 'G38002', 'G38003'])
    expect(lignes.map(l => l['@couleurs'])).toEqual([{}, { '{note_1}': 'alerte' }, {}])
  })

  it('applique le code couleur vert / rouge des resultats', () => {
    expect(v['@couleurs']).toMatchObject({
      '{resultat_pratique}': 'ko', '{pourcentage}': 'ko', '{statut_elearning}': 'ko',
    })
    const reussi = {
      ...brouillon,
      participants: [{ ...brouillon.participants[0], notesModules: { m1: 90, m2: 80, m3: 80 } }],
    }
    const w = valeursDrapeaux(reussi, null, {}, fiche, {})
    expect(w['{resultat_pratique}']).toBe(VALIDE)
    expect(w['@couleurs']['{pourcentage}']).toBe('ok')
  })
})

describe('pages jour', () => {
  it('suivent toutes le meme sens, sans alternance', () => {
    expect([1, 2, 3, 4, 5].map(n => diapoDe({ cle: `jour-${n}` }, {}))).toEqual([11, 11, 11, 11, 11])
  })
})

describe('intercalaires', () => {
  const cles = ['couverture', 'participants', 'objectifs', 'jour-1', 'jour-2', 'resultats',
    'satisfaction', 'bilan', 'fiche-a', 'fiche-b', 'cloture']

  it('annoncent chaque section, dans l’ordre du modèle', () => {
    const r = avecIntercalaires(cles.map(cle => ({ cle, diapo: 1 })))
    expect(r.map(p => p.cle)).toEqual(['couverture', 'intercalaire-3', 'participants',
      'intercalaire-5', 'objectifs', 'intercalaire-10', 'jour-1', 'jour-2', 'intercalaire-16',
      'resultats', 'satisfaction', 'bilan', 'intercalaire-25', 'fiche-a', 'fiche-b', 'cloture'])
    expect(r.filter(p => p.cle.startsWith('intercalaire-')).map(p => p.valeurs))
      .toEqual([{ 1: '1' }, { 2: '2' }, { 3: '3' }, { 4: '4' }, { 5: '5' }])
  })

  it('se renumérotent quand une section est écartée', () => {
    const r = avecIntercalaires(cles.filter(c => c !== 'objectifs').map(cle => ({ cle, diapo: 1 })))
    expect(r.filter(p => p.cle.startsWith('intercalaire-')).map(p => [p.diapo, p.valeurs]))
      .toEqual([[3, { 1: '1' }], [10, { 3: '2' }], [16, { 4: '3' }], [25, { 5: '4' }]])
  })

  it('listent les stagiaires avant les fiches', () => {
    const v = valeursDrapeaux(brouillon, null, {}, fiche, {})
    const r = avecIntercalaires([{ cle: 'fiche-c1', diapo: 26, valeurs: v }])
    expect(r[0].valeurs['@lignes']['{stagiaire_nom}'].map(l => l['{stagiaire_nom}']))
      .toEqual(['Paul KAMGA'])
  })
})

describe('formuleCertification', () => {
  it('rappelle la règle de certification de la marque', () => {
    const v = formuleCertification({ type: 'certification', marque: 'toyota' })
    expect(v['@formule_certification']).toBe(
      'Nous rappelons que la certification TOYOTA pour chacun des niveaux '
      + 'est obtenue de la façon suivante :')
  })

  it('omet la marque quand elle est absente', () => {
    const v = formuleCertification({ type: 'certification' })
    expect(v['@formule_certification']).toContain('la certification pour chacun')
  })

  it('ne dit rien pour une formation', () => {
    expect(formuleCertification({ type: 'formation', marque: 'toyota' })).toEqual({})
  })
})
