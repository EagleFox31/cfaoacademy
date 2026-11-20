import PortalHeader from '../../../../components/PortalHeader'
import PortalHeroKpis from '../../../../components/PortalHeroKpis.jsx'
import { useChiffresFiliale } from '../../../../hooks/useMarquesFiliale.js'
import { HERO_KPIS } from '../configs/consultation.js'
import { perimetreDuMode } from '../sources/consultation.js'

/** Nom accordé au chiffre : clé `_one` pour 0 ou 1 (pluriel si inconnu). */
const accorde = (t, cle, n) => t[n != null && n <= 1 ? `${cle}_one` : cle] ?? t[cle]

/** Chiffres et mots accordés de la phrase du hero. */
const phrase = (t, { techs, cands, filiales, marques }) => ({
  techs, techs_mot: accorde(t, 'consult_hero_techs', techs),
  cands, cands_mot: accorde(t, 'consult_hero_cands', cands),
  filiales, filiales_mot: accorde(t, 'consult_hero_branches', filiales),
  marques, marques_mot: accorde(t, 'consult_hero_brands', marques),
})

/**
 * Haut de page du portail de consultation, à la norme DPS / centre :
 * « Bonsoir, Aminata, au sein de votre filiale … » puis une phrase en grand
 * qui dit le métier du rôle (`consult_hero_<rôle>`, portal.json), chiffrée :
 *   - vue détaillée (groupe, RH et admin filiale) : extrait MEDACAP du jeu RH,
 *     marques de la filiale lues dans MEDACAP ;
 *   - directeur de filiale : techniciens et marques lus dans MEDACAP ;
 *   - directeur régional : pas encore de source par région → « — ».
 * Jamais de chiffre inventé : inconnu = « — », comme le DPS.
 * Sous la phrase, les chiffres propres au rôle (HERO_KPIS), s'il en a.
 * RH filiale dont la filiale est inconnue : en-tête par défaut.
 */
export default function ConsultationHeader({ t, tPortal, ctx, values }) {
  const { portee, vueDetaillee } = perimetreDuMode(ctx.mode, ctx.user)
  const filiale = portee === 'filiale'
  const medacap = useChiffresFiliale(filiale ? ctx.user : null)
  const gabarit = tPortal[`consult_hero_${ctx.mode}`]
  if (!gabarit || (filiale && !vueDetaillee && ctx.mode !== 'branch_director')) {
    return <PortalHeader user={ctx.user} />
  }
  let chiffres = {}
  if (vueDetaillee) {
    chiffres = phrase(tPortal, {
      techs: values.personnes.techniciens,
      cands: values.personnes.candidats,
      filiales: values.competences.parFiliale.length,
      marques: medacap.marques,
    })
  } else if (ctx.mode === 'branch_director') {
    chiffres = phrase(tPortal, { techs: medacap.techniciens, marques: medacap.marques })
  } else if (portee === 'region') {
    chiffres = phrase(tPortal, { techs: null, filiales: null })
  }
  const kpis = HERO_KPIS[ctx.mode]
  return (
    <PortalHeader user={ctx.user} statsHero={{ gabarit, chiffres, filiale }}
      belowGreeting={kpis ? <PortalHeroKpis kpis={kpis} t={t} values={values} /> : null} />
  )
}
