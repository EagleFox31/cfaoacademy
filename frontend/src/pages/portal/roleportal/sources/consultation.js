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
  const { sections, filialeFixe } = perimetreDuMode(ctx.mode, ctx.user)

  return useMemo(() => {
    const perimetre = filialeFixe ? { ...PERIMETRE_GROUPE, filiale: filialeFixe } : PERIMETRE_GROUPE
    const recrutement = syntheseRecrutement(perimetre)
    return {
      values: {
        filialeFixe,
        // Seules les priorités des sections ouvertes au rôle remontent.
        aTraiter: priorites(perimetre).filter(a => sections.includes(a.espace)),
        ...campagnes(recrutement),
        competences: syntheseCompetences(perimetre),
        pif: synthesePIF(perimetre),
        personnes: synthesePersonnes(perimetre),
      },
      loading: false,
    }
  }, [filialeFixe, sections])
}
