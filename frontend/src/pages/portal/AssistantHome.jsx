import RolePortal from './roleportal/RolePortal.jsx'
import assistant from './roleportal/configs/assistant.js'
import { useAssistantSources } from './roleportal/sources/assistant.js'
import AssistantSessionsSection from './roleportal/sections/AssistantSessionsSection.jsx'
import PortalHeader from '../../components/PortalHeader'
import PortalHeroKpis from '../../components/PortalHeroKpis.jsx'
import { chiffresHero } from './CenterHome.jsx'

/** Même phrase chiffrée que le reste de l'équipe du centre, puis ses 3 chiffres cliquables. */
function AssistantHeader({ ctx, t, values }) {
  return (
    <PortalHeader user={ctx.user} centerHero={chiffresHero({ mode: 'assistant' })}
      belowGreeting={<PortalHeroKpis kpis={assistant.heroKpis} t={t} values={values} />} />
  )
}

const RICH = { header: AssistantHeader, sessions: AssistantSessionsSection }

/** Portail de l'assistante du centre : configuration dans `roleportal/configs/assistant.js`. */
export default function AssistantHome() {
  return <RolePortal config={assistant} useSources={useAssistantSources} rich={RICH} />
}
