import { useMemo } from 'react'
import { CONSULTATION_MODES } from '../../portalProfiles.js'
import {
  PERIMETRE_GROUPE, codeFiliale, priorites,
  syntheseRecrutement, syntheseCompetences, synthesePIF, synthesePersonnes,
} from '../../../../utils/rhDonnees'

/**
 * Périmètre d'un rôle de consultation. Vue détaillée (chiffres par
 * technicien) : groupe, ou filiale de l'utilisateur connue. Sinon, seules
 * les sections sans données du jeu RH restent (macro, besoins, clé).
 */
export function perimetreDuMode(mode, user) {
  const { perimetre: portee, sections, detail } = CONSULTATION_MODES[mode] ?? CONSULTATION_MODES.group_hr
  const filialeFixe = portee === 'filiale' && detail ? codeFiliale(user?.pays) : null
  return { portee, sections, filialeFixe, vueDetaillee: portee === 'groupe' || Boolean(filialeFixe) }
}

/** Campagnes de recrutement : ouvertes d'un côté, clôturées de l'autre. */
export function campagnes(recrutement) {
  const somme = (liste, cle) => liste.reduce((n, c) => n + c[cle], 0)
  const ouvertes = recrutement.campagnes.filter(c => c.statut === 'ouverte')
  const closes = recrutement.campagnes.filter(c => c.statut !== 'ouverte')
  const notees = closes.filter(c => c.moyenne != null && c.testes)
  return {
    enCours: {
      nombre: ouvertes.length,
      candidats: somme(ouvertes, 'candidats'),
      testes: somme(ouvertes, 'testes'),
      avancement: Math.round(100 * somme(ouvertes, 'testes') / (somme(ouvertes, 'candidats') || 1)),
    },
    terminees: {
      nombre: closes.length,
      candidats: somme(closes, 'candidats'),
      testes: somme(closes, 'testes'),
      moyenne: notees.length
        ? Math.round(notees.reduce((n, c) => n + c.moyenne * c.testes, 0) / somme(notees, 'testes'))
        : null,
    },
  }
}

/** Données du portail de consultation (extrait MEDACAP anonymisé) : tout le
 * groupe, ou la seule filiale de la RH ou de l'admin filiale. */
export function useConsultationSources(ctx) {
  const { sections, filialeFixe, vueDetaillee } = perimetreDuMode(ctx.mode, ctx.user)

  return useMemo(() => {
    const perimetre = filialeFixe ? { ...PERIMETRE_GROUPE, filiale: filialeFixe } : PERIMETRE_GROUPE
    const recrutement = syntheseRecrutement(perimetre)
    const parStatut = campagnes(recrutement)
    const competences = syntheseCompetences(perimetre)
    const pif = synthesePIF(perimetre)
    const personnes = synthesePersonnes(perimetre)
    return {
      values: {
        filialeFixe,
        // Seules les priorités des sections ouvertes au rôle remontent.
        aTraiter: priorites(perimetre).filter(a => sections.includes(a.espace)),
        ...parStatut,
        competences,
        pif,
        personnes,
        ...chiffresDuHero(vueDetaillee, { enCours: parStatut.enCours, competences, pif, personnes }),
      },
      loading: false,
    }
  }, [filialeFixe, sections, vueDetaillee])
}

/**
 * Chiffres du hero (HERO_KPIS, configs/consultation.js), à plat. Hors vue
 * détaillée : tous `null` (« — »), rien du jeu RH ne s'affiche.
 */
export function chiffresDuHero(vueDetaillee, { enCours, competences, pif, personnes }) {
  if (!vueDetaillee) {
    return { nonEvalues: null, sansPlan: null, plansAValider: null, fichesACompleter: null,
      campagnesOuvertes: null, pctEvalues: null, pctPlans: null }
  }
  return {
    nonEvalues: competences.techniciens - competences.evalues,
    sansPlan: pif.techniciens - pif.avecPif,
    plansAValider: pif.avecPif - pif.valides,
    fichesACompleter: personnes.aCompleter,
    campagnesOuvertes: enCours.nombre,
    pctEvalues: competences.couverture,
    pctPlans: pif.couverture,
  }
}
