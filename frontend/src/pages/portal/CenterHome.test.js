// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { KPIS_COORDINATEUR, alertesCle, chiffresCoordinateur, chiffresHero, chiffresPresences, etatAnnee, kpisCoordinateur } from './CenterHome.jsx'
import { PAYS_ACADEMY, PLATEFORME, teinteCarte, SECTIONS_COORDINATEUR, SECTIONS_DIRECTEUR, anneeDuResume, paysAttendus, statutBesoins } from './CenterDirectorSections.jsx'
import { resolveProfile } from './portalProfiles.js'
import { getPortalNavSections } from '../../data/index.js'
import { CENTER_HOME_COPY } from '../../i18n/centerHome.js'

describe('chiffres du hero du coordinateur', () => {
  const cle = { statut: 'DRAFT', connues: 20, repondu: 30, points: [{ id: 1 }, { id: 2 }] }
  const futur = new Date().getFullYear() + 1

  it('pendant le recueil : filiales sans réponse', () => {
    expect(chiffresCoordinateur({ statut: 'pret', access: { review: true }, annee: futur, cle }))
      .toEqual({ aRelancer: PAYS_ACADEMY - 30, rapportsAttendus: null,
        formationsTerminees: null, stagiairesFormes: null })
  })

  it('plus de chiffre « devis des filiales » ni « sessions trop rapprochées » dans le hero', () => {
    const ids = KPIS_COORDINATEUR.map(k => k.id)
    expect(ids).not.toContain('a-corriger')
    expect(ids).not.toContain('rapprochees')
    expect(ids).toEqual(['a-relancer', 'rapports', 'terminees', 'formes'])
  })

  it('bilan de l’année : formations terminées et participations présentes, tels quels', () => {
    const presences = { loaded: true, trainings_completed: 180, participations_present: 1466, people_trained: 743 }
    expect(chiffresCoordinateur({ statut: 'erreur', cle: null }, presences))
      .toMatchObject({ formationsTerminees: 180, stagiairesFormes: 1466 })
    expect(chiffresPresences({ loaded: true, trainings_completed: 0, participations_present: 0 }))
      .toEqual({ formationsTerminees: 0, stagiairesFormes: 0 })
  })

  it('liste de présence non chargée : « — » et « liste non chargée », jamais 0', () => {
    const vide = { loaded: false, trainings_completed: 0, participations_present: 0 }
    expect(chiffresPresences(vide)).toEqual({ formationsTerminees: null, stagiairesFormes: null })
    const bilan = kpisCoordinateur(vide).filter(k => k.neutre)
    expect(bilan).toHaveLength(2)
    expect(bilan.every(k => k.inconnu === 'hero_kpi_presences_absentes')).toBe(true)
    expect(CENTER_HOME_COPY.fr.hero_kpi_presences_absentes).toBeTruthy()
    // Panne ou refus (null) : « — » avec le libellé habituel.
    expect(chiffresPresences(null)).toEqual({ formationsTerminees: null, stagiairesFormes: null })
    expect(kpisCoordinateur(null)).toBe(KPIS_COORDINATEUR)
  })

  it('recueil clos : plus personne à relancer', () => {
    expect(chiffresCoordinateur({ statut: 'pret', access: {}, annee: futur, cle: { ...cle, statut: 'FROZEN' } }))
      .toMatchObject({ aRelancer: 0 })
  })

  it('sans clé chargée, aucun chiffre inventé', () => {
    expect(Object.values(chiffresCoordinateur({ statut: 'erreur', cle: null }))).toEqual([null, null, null, null])
  })

  it('chaque chiffre vise une rubrique de sa page et a ses 3 libellés', () => {
    expect(KPIS_COORDINATEUR.map(k => k.cible).every(id => SECTIONS_COORDINATEUR.includes(id))).toBe(true)
    for (const { label } of KPIS_COORDINATEUR)
      for (const s of ['', '_one', '_zero']) expect(CENTER_HOME_COPY.fr[label + s]).toBeTruthy()
  })
})

describe('plateforme du directeur du centre', () => {
  it('a la carte « Voir les portails des profils », libellée dans les trois langues', () => {
    expect(PLATEFORME).toEqual(['portails', 'site', 'support', 'reports'])
    for (const langue of ['fr', 'en', 'pt']) {
      for (const id of PLATEFORME) {
        expect(CENTER_HOME_COPY[langue][`dir_plateforme_${id}`]).toBeTruthy()
        expect(CENTER_HOME_COPY[langue][`dir_plateforme_${id}_meta`]).toBeTruthy()
      }
    }
    expect(CENTER_HOME_COPY.fr.dir_plateforme_portails).toBe('Voir les portails des profils')
  })
})

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
    expect(getPortalNavSections(['center_assistant']).map(s => s.id)).toEqual(['prochaines-sessions', 'dossiers', 'a-consulter'])
    expect(getPortalNavSections(['training_coordinator']).map(s => s.id)).toEqual(SECTIONS_COORDINATEUR)
    expect(getPortalNavSections(['center_director']).map(s => s.id)).toEqual(SECTIONS_DIRECTEUR)
  })

  it('recueil des besoins : clos dès que l’exercice a commencé ou que la clé est gelée', () => {
    const a = { annee: 2027, gelee: false, repondu: 7, connus: 24 }
    expect(statutBesoins(a, 2026).cle).toBe('chip_ongoing')
    expect(statutBesoins({ ...a, repondu: 24 }, 2026).cle).toBe('chip_complete')
    expect(statutBesoins({ ...a, gelee: true }, 2026).cle).toBe('chip_closed')
    expect(statutBesoins({ ...a, annee: 2026, repondu: 20 }, 2026).cle).toBe('chip_closed')
  })

  const LIGNE = {
    year: 2027, status: 'DRAFT', answered: 8, known: 35, needs: 727, seats: 135,
    seats_offered: 180, fill_rate: 75, computed_at: '2026-11-18T10:00:00Z',
  }

  it('une année du résumé serveur : chiffres repris tels quels, sans calcul', () => {
    expect(anneeDuResume(LIGNE)).toEqual({
      annee: 2027, gelee: false, statut: 'DRAFT', repondu: 8, connus: 35, besoins: 727,
      places: 135, offertes: 180, taux: 75,
    })
    expect(anneeDuResume({ ...LIGNE, status: 'FROZEN' }).gelee).toBe(true)
  })

  it('pays attendus : tout le périmètre Academy pendant le recueil, la clé du pôle une fois clos', () => {
    expect(PAYS_ACADEMY).toBe(35)
    const ouverte = { annee: 2027, gelee: false }
    expect(paysAttendus(ouverte, { pole: 'MOTORS', connus: 24 }, 2026)).toBe(35)
    expect(paysAttendus(ouverte, { pole: 'EQUIPMENT', connus: 19 }, 2026)).toBe(35)
    expect(paysAttendus({ annee: 2026, gelee: true }, { pole: 'EQUIPMENT', connus: 19 }, 2026)).toBe(19)
    expect(paysAttendus({ annee: 2026, gelee: false }, { pole: 'MOTORS', connus: 24 }, 2026)).toBe(24)
  })

  it('une carte par année : la ligne du résumé et les points à traiter', () => {
    expect(etatAnnee(LIGNE, [{ id: 1 }, { id: 2 }])).toEqual({
      statut: 'DRAFT', places: 135, offertes: 180, taux: 75, repondu: 8, connues: 35,
      points: [{ id: 1 }, { id: 2 }],
    })
    // Sans capacité saisie : pas de taux inventé.
    expect(etatAnnee({ ...LIGNE, seats_offered: null, fill_rate: null }))
      .toMatchObject({ offertes: null, taux: null, points: [] })
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

describe('couleur des cartes', () => {
  it('jaune orangé réservé au chantier : une carte ouverte en cours passe en vert, les autres statuts gardent leur couleur', () => {
    expect(teinteCarte('progress')).toBe('done')
    for (const c of ['done', 'closed', 'open', 'todo']) expect(teinteCarte(c)).toBe(c)
  })
})
