import useAuth from '../../hooks/useAuth'
import { CONSULTATION_MODES } from './portalProfiles.js'
import RolePortal from './roleportal/RolePortal.jsx'
import consultation from './roleportal/configs/consultation.js'
import { perimetreDuMode, useConsultationSources } from './roleportal/sources/consultation.js'
import {
  ATraiterSection, BesoinsSection, CompetencesSection, PersonnesSection, PifSection, RecrutementSection,
} from './roleportal/sections/ConsultationSections.jsx'
import ConsultationHeader from './roleportal/sections/ConsultationHeader.jsx'

const RICH = {
  header: ConsultationHeader,
  aTraiter: ATraiterSection,
  besoins: BesoinsSection,
  recrutement: RecrutementSection,
  competences: CompetencesSection,
  pif: PifSection,
  personnes: PersonnesSection,
}

/**
 * Portail de consultation (fabrique, configs/consultation.js) : RH groupe et
 * filiale, directeurs groupe, régional et de filiale, admins groupe et
 * filiale. `mode` = le rôle (CONSULTATION_MODES) ; il choisit les sections.
 * Vue détaillée : groupe, ou filiale de l'utilisateur connue ; sinon résultats
 * et PIF restent en construction et rien du jeu RH ne s'affiche.
 */
export default function RHHome({ mode: demande = 'group_hr' }) {
  const { user } = useAuth()
  const mode = CONSULTATION_MODES[demande] ? demande : 'group_hr'
  const { vueDetaillee } = perimetreDuMode(mode, user)
  return (
    <RolePortal config={consultation} mode={mode} detail={vueDetaillee}
      useSources={useConsultationSources} rich={RICH} />
  )
}
