// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { alertesCle, chiffresHero, etatAnnee, tauxRemplissage } from './CenterHome.jsx'
import { PAYS_ACADEMY, SECTIONS_DIRECTEUR, paysAttendus, statutBesoins, syntheseAnnee } from './CenterDirectorSections.jsx'
import { resolveProfile } from './portalProfiles.js'
import { getPortalNavSections } from '../../data/index.js'
import { CENTER_HOME_COPY } from '../../i18n/centerHome.js'

describe('portail du centre de formation', () => {
  it.each([
    ['center_director', 'director'],
    ['training_coordinator', 'coordinator'],
    ['center_assistant', 'assistant'],
  ])('%s : profil center, mode %s', (role, mode) => {
    expect(resolveProfile([role])).toMatchObject({ key: 'center', mode })
  })

  it('le directeur l’emporte sur le coordinateur', () => {
    expect(resolveProfile(['training_coordinator', 'center_director']).mode).toBe('director')
  })

  it('un autre rôle de portail garde son tableau de bord', () => {
    expect(resolveProfile(['center_director', 'dps']).key).toBe('dps')
  })

  it('sections de navigation alignées sur les ancres de la page', () => {
    for (const role of ['training_coordinator', 'center_assistant']) {
      expect(getPortalNavSections([role]).map(s => s.id)).toEqual(['cle', 'outils', 'bientot'])
    }
    expect(getPortalNavSections(['center_director']).map(s => s.id)).toEqual(SECTIONS_DIRECTEUR)
  })

  it('recueil des besoins : clos dès que l’exercice a commencé ou que la clé est gelée', () => {
    const a = { annee: 2027, gelee: false, repondu: 7, connus: 24 }
    expect(statutBesoins(a, 2026).cle).toBe('chip_ongoing')
    expect(statutBesoins({ ...a, repondu: 24 }, 2026).cle).toBe('chip_complete')
    expect(statutBesoins({ ...a, gelee: true }, 2026).cle).toBe('chip_closed')
    expect(statutBesoins({ ...a, annee: 2026, repondu: 20 }, 2026).cle).toBe('chip_closed')
  })

  it('synthèse d’une année : pays comptés une fois, besoins et places par marque', () => {
    const a = syntheseAnnee({
      year: 2027, status: 'DRAFT', total_seats: 30, rows: [{}, {}, {}],
      responses: [
        { pole: 'EQUIPMENT', answered: ['CM'], known: ['CM', 'GA'], needs: 12 },
        { pole: 'MOTORS', answered: ['CM', 'CI'], known: ['CM', 'CI', 'SN'], needs: 40 },
      ],
      brands: [{ code: 'toyota', label: 'TOYOTA' }, { code: 'jcb', label: 'JCB' }],
      brand_totals: { toyota: { needs: 40, seats: 20 }, jcb: { needs: 12, seats: 10 } },
    })
    expect(a).toMatchObject({ annee: 2027, gelee: false, repondu: 2, connus: 4, besoins: 52, places: 30, filiales: 3 })
    expect(a.poles).toEqual([
      { pole: 'MOTORS', repondu: 2, connus: 3, besoins: 40 },
      { pole: 'EQUIPMENT', repondu: 1, connus: 2, besoins: 12 },
    ])
    expect(a.marques).toEqual([
      { code: 'toyota', label: 'TOYOTA', besoins: 40, places: 20 },
      { code: 'jcb', label: 'JCB', besoins: 12, places: 10 },
    ])
  })

  it('pays attendus : tout le périmètre Academy pendant le recueil, la clé du pôle une fois clos', () => {
    expect(PAYS_ACADEMY).toBe(35)
    const ouverte = { annee: 2027, gelee: false }
    expect(paysAttendus(ouverte, { pole: 'MOTORS', connus: 24 }, 2026)).toBe(35)
    expect(paysAttendus(ouverte, { pole: 'EQUIPMENT', connus: 19 }, 2026)).toBe(35)
    expect(paysAttendus({ annee: 2026, gelee: true }, { pole: 'EQUIPMENT', connus: 19 }, 2026)).toBe(19)
    expect(paysAttendus({ annee: 2026, gelee: false }, { pole: 'MOTORS', connus: 24 }, 2026)).toBe(24)
  })

  it('taux de remplissage = places attribuées / places mises à disposition', () => {
    expect(tauxRemplissage(45, 60)).toBe(75)
    expect(tauxRemplissage(10, 0)).toBeNull()
    expect(tauxRemplissage(10, null)).toBeNull()
  })

  it('une carte par année : places additionnées, filiales comptées une fois', () => {
    const cles = [
      { pole: 'MOTORS', status: 'DRAFT', seats_offered: 40 },
      { pole: 'EQUIPMENT', status: 'FROZEN', seats_offered: 20 },
    ]
    const g = {
      year: 2027, status: 'DRAFT', total_seats: 50,
      responses: [
        { pole: 'MOTORS', answered: ['cm', 'ci'], known: ['cm', 'ci', 'sn'] },
        { pole: 'EQUIPMENT', answered: ['cm'], known: ['cm', 'ga'] },
      ],
      review_items: [{ id: 1 }, { id: 2 }],
    }
    expect(etatAnnee(cles, g)).toEqual({
      statut: 'DRAFT', places: 50, offertes: 60, repondu: 2, connues: 4, points: [{ id: 1 }, { id: 2 }],
    })
    // Synthèse illisible : l'état vient des clés, sans chiffre inventé.
    expect(etatAnnee([{ status: 'FROZEN', seats_offered: null }], null))
      .toEqual({ statut: 'FROZEN', places: 0, offertes: null, repondu: 0, connues: 0, points: [] })
  })

  it('cloche : le coordinateur ouvre la session, le directeur lit sans lien d’action', () => {
    const tCle = { review_open: 'Ouvrir', review_late: '{code} en retard ({country})' }
    const points = [
      { id: 1, issue: 'late', code: 'S12', country: 'CM', country_label: 'Cameroun' },
      { id: 2, issue: 'inconnu', code: 'S13', country: 'CI', country_label: 'Côte d’Ivoire' },
    ]
    const ouvertes = []
    const coord = alertesCle(points, tCle, 'fr', i => ouvertes.push(i.code))
    expect(coord).toHaveLength(1)
    expect(coord[0]).toMatchObject({ label: 'Cameroun · S12', text: 'S12 en retard (Cameroun)', cta: 'Ouvrir' })
    coord[0].onOpen()
    expect(ouvertes).toEqual(['S12'])
    const dir = alertesCle(points, tCle, 'fr')
    expect(dir).toEqual([{ id: 1, label: 'Cameroun · S12', text: 'S12 en retard (Cameroun)' }])
  })

  it('hero : pays de la carte et marques du périmètre officiel', () => {
    const hero = chiffresHero({ mode: 'director' })
    expect(hero).toMatchObject({ mode: 'director', countries: 35, brands: 22 })
    // Les logos ouverts au clic sur « 22 marques » : chacun a son image.
    expect(hero.brandList.length).toBeGreaterThan(0)
    expect(hero.brandList.every(b => b.name && b.logo)).toBe(true)
  })

  it('mêmes clés de traduction en fr, en et pt', () => {
    const cles = Object.keys(CENTER_HOME_COPY.fr).sort()
    expect(Object.keys(CENTER_HOME_COPY.en).sort()).toEqual(cles)
    expect(Object.keys(CENTER_HOME_COPY.pt).sort()).toEqual(cles)
  })
})
