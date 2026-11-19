import PortalHeader from '../../../../components/PortalHeader'
import useMarquesFiliale from '../../../../hooks/useMarquesFiliale.js'
import { perimetreDuMode } from '../sources/consultation.js'

/** Nom accordé au chiffre : clé `_one` pour 0 ou 1 (pluriel si inconnu). */
const accorde = (t, cle, n) => t[n != null && n <= 1 ? `${cle}_one` : cle] ?? t[cle]

/**
 * Haut de page du portail de consultation, à la norme DPS / centre :
 * « Bonsoir, Aminata, au sein de votre filiale … » puis une phrase en grand
 * qui dit le métier du rôle, chiffrée avec l'extrait MEDACAP
 * (`consult_hero_<rôle>`, portal.json). Nombre de marques inconnu : « — »,
 * comme le DPS, jamais de chiffre inventé. Sans chiffres (directeur régional,
 * directeur de filiale), la phrase reste en grand.
 * RH filiale dont la filiale est inconnue : en-tête par défaut.
 */
export default function ConsultationHeader({ tPortal: t, ctx, values }) {
  const { portee, vueDetaillee } = perimetreDuMode(ctx.mode, ctx.user)
  const filiale = portee === 'filiale'
  const marques = useMarquesFiliale(filiale ? ctx.user : null)
  const gabarit = t[`consult_hero_${ctx.mode}`]
  if (!gabarit || (filiale && !vueDetaillee && ctx.mode !== 'branch_director')) {
    return <PortalHeader user={ctx.user} />
  }
  const chiffres = {}
  if (vueDetaillee) {
    const { techniciens, candidats } = values.personnes
    const filiales = values.competences.parFiliale.length
    Object.assign(chiffres, {
      techs: techniciens, techs_mot: accorde(t, 'consult_hero_techs', techniciens),
      cands: candidats, cands_mot: accorde(t, 'consult_hero_cands', candidats),
      filiales, filiales_mot: accorde(t, 'consult_hero_branches', filiales),
      marques, marques_mot: accorde(t, 'consult_hero_brands', marques),
    })
  }
  return <PortalHeader user={ctx.user} statsHero={{ gabarit, chiffres, filiale }} />
}
