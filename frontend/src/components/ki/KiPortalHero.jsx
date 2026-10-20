import { useMemo, useState } from 'react'
import useLocale from '../../hooks/useLocale.js'
import PortalGreetingBlock from '../PortalGreetingBlock.jsx'
import PortalHeroShell from '../PortalHeroShell.jsx'
import PortalRoleBadge from '../PortalRoleBadge.jsx'
import KiHeroCard from '../KiHeroCard.jsx'
import PortalBrandLogo from '../PortalBrandLogo.jsx'
import { buildKiHeroModel } from '../../utils/kiHeroModel.js'
import { computePortalGreetingKey } from '../../utils/portalGreeting.js'

/** Hero instructeur filiale (KI Toyota · PIC Suzuki). */
export default function KiPortalHero({ user, lms, loading = false }) {
  const { t } = useLocale('portal')
  const [greetingKey] = useState(() => computePortalGreetingKey())
  const model = useMemo(() => buildKiHeroModel(user, lms), [user, lms])
  const roleKey = model.instructorKind

  return (
    <PortalHeroShell aside={<KiHeroCard model={model} />} className="portal-page-header--ki">
      <div className="portal-header-role-line">
        <PortalRoleBadge role={roleKey} label={t[`role_${roleKey}`]} />
      </div>
      <PortalGreetingBlock
        greetingKey={t[greetingKey]}
        firstName={user.firstName}
        user={user}
        primaryRole={roleKey}
        hideOrient
        kiHero={{
          kind: model.instructorKind,
          technicianCount: model.technicianCount,
          brandLabel: model.brandLabel,
          loading,
        }}
      />
      {model.brand && (
        <div className="portal-header-geo-row portal-header-geo-row--grid portal-header-geo-row--instructor">
          <div className="portal-header-geo-brands">
            <PortalBrandLogo brand={model.brand} size="geo" />
          </div>
        </div>
      )}
    </PortalHeroShell>
  )
}
