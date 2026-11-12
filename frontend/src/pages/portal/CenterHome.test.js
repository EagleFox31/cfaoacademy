// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { chiffresHero, tauxRemplissage } from './CenterHome.jsx'
import { SECTIONS_DIRECTEUR, statutBesoins, syntheseAnnee } from './CenterDirectorSections.jsx'
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
        { pole: 'MOTORS', answered: ['CM', 'CI'], known: ['CM', 'CI', 'SN'] },
        { pole: 'EQUIPMENT', answered: ['CM'], known: ['CM', 'GA'] },
      ],
      brands: [{ code: 'toyota', label: 'TOYOTA' }, { code: 'jcb', label: 'JCB' }],
      brand_totals: { toyota: { needs: 40, seats: 20 }, jcb: { needs: 12, seats: 10 } },
    })
    expect(a).toMatchObject({ annee: 2027, gelee: false, repondu: 2, connus: 4, besoins: 52, places: 30, filiales: 3 })
    expect(a.marques).toEqual([
      { code: 'toyota', label: 'TOYOTA', besoins: 40, places: 20 },
      { code: 'jcb', label: 'JCB', besoins: 12, places: 10 },
    ])
  })

  it('taux de remplissage = places attribuées / places mises à disposition', () => {
    expect(tauxRemplissage(45, 60)).toBe(75)
    expect(tauxRemplissage(10, 0)).toBeNull()
    expect(tauxRemplissage(10, null)).toBeNull()
  })

  it('hero : pays de la carte et marques du périmètre officiel', () => {
    expect(chiffresHero({ mode: 'director' })).toEqual({ mode: 'director', countries: 35, brands: 22 })
  })

  it('mêmes clés de traduction en fr, en et pt', () => {
    const cles = Object.keys(CENTER_HOME_COPY.fr).sort()
    expect(Object.keys(CENTER_HOME_COPY.en).sort()).toEqual(cles)
    expect(Object.keys(CENTER_HOME_COPY.pt).sort()).toEqual(cles)
  })
})
