import CardMemberTitle from './CardMemberTitle.jsx'
import { dpsCompetencyTierAvatarVariant } from '../utils/dpsCompetencyTierTheme.js'

/**
 * Nom collaborateur + avatar (initiales ou icône Toyota Gx / poste).
 * @see docs/dps-competency-tier-visual.md
 */
export default function DpsCompetencyTierMemberTitle({ name, tier, person = null, avatarSrc = null }) {
  return (
    <CardMemberTitle
      name={name}
      variant={dpsCompetencyTierAvatarVariant(tier)}
      person={person}
      avatarSrc={avatarSrc}
    />
  )
}
