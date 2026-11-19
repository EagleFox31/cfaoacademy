import RolePortal from './roleportal/RolePortal.jsx'
import trainer from './roleportal/configs/trainer.js'
import { trainerSelectors, useTrainerSources } from './roleportal/sources/trainer.js'
import TrainerSessionsSection from './roleportal/sections/TrainerSessionsSection.jsx'
import TrainerAssistanceSection from './roleportal/sections/TrainerAssistanceSection.jsx'
import TrainerHeader from './roleportal/sections/TrainerHeader.jsx'
import { adresseComptesRendus } from '../../utils/urlComptesRendus.js'

const RICH = { header: TrainerHeader, sessions: TrainerSessionsSection, assistance: TrainerAssistanceSection }

// Le module des comptes rendus est une application à part : on y va par
// son adresse, pas par une route du portail.
const ouvrirModule = chemin => window.location.assign(adresseComptesRendus({ pathname: chemin }))

/** Tableau de bord du formateur : configuration dans `roleportal/configs/trainer.js`. */
export default function TrainerHome() {
  return (
    <RolePortal
      config={trainer}
      useSources={useTrainerSources}
      selectors={trainerSelectors}
      rich={RICH}
      onModule={ouvrirModule}
    />
  )
}
