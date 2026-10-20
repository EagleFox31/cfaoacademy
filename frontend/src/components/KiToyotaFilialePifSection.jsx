import { useMemo } from 'react'
import DpsFilialePifSection from './DpsFilialePifSection.jsx'
import { resolveKiFilialePifTechnicians } from '../utils/kiScope.js'
import { resolveTeamgpElearningForTechnician } from '../utils/teamgpElearning.js'

/** PIF techniciens filiale — marque instructeur Toyota + volumes TEAM-GP Excel. */
export default function KiToyotaFilialePifSection(props) {
  const { lms } = props
  const technicians = useMemo(
    () => resolveKiFilialePifTechnicians(lms).map(tech => ({
      ...tech,
      teamgp: resolveTeamgpElearningForTechnician(tech.id),
    })),
    [lms],
  )

  return (
    <DpsFilialePifSection
      {...props}
      sectionId="toyota-pif"
      technicians={technicians}
      titleKey="ki_title_toyota_pif"
      eyebrowKey="ki_eyebrow_toyota_pif"
      methodKey="ki_method_toyota_pif"
    />
  )
}
