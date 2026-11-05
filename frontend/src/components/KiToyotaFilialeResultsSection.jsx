import { useMemo } from 'react'
import DpsCollaboratorResultsSection from './DpsCollaboratorResultsSection.jsx'
import KiTeamgpElearningResultCard from './KiTeamgpElearningResultCard.jsx'
import { resolveKiDisplayUser } from '../utils/kiScope.js'

/** Résultats compétence filiale — marque instructeur Toyota + card e-learning TEAM-GP. */
export default function KiToyotaFilialeResultsSection(props) {
  const { user, lms, t } = props
  const displayUser = useMemo(
    () => resolveKiDisplayUser(user, lms),
    [user, lms],
  )

  return (
    <DpsCollaboratorResultsSection
      {...props}
      user={displayUser}
      sectionId="toyota-resultats"
      titleKey="ki_title_toyota_results"
      eyebrowKey="ki_eyebrow_toyota_results"
      methodKey="ki_method_toyota_results"
      tierNomenclature="toyota"
      extraCards={<KiTeamgpElearningResultCard t={t} />}
    />
  )
}
