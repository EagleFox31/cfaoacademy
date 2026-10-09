import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import useLocale from '../hooks/useLocale'
import { getPrimaryRole } from '../pages/portal/Portal'
import { profileDemoOptionLabel, sortDemoProfiles } from '../utils/demoProfiles.js'


export default function PortalDemoBar() {
  const { user, login, profiles } = useAuth()
  const { t } = useLocale('portal')
  const navigate = useNavigate()
  const sortedProfiles = useMemo(() => sortDemoProfiles(profiles), [profiles])
  // Un compte personnel ne passe pas d'un profil a l'autre.
  if (!user || user.compte) return null

  function handleChange(e) {
    const id = e.target.value
    login(id)
    const profile = profiles.find(p => p.id === id)
    const role = getPrimaryRole(profile?.roles ?? [])
    if (role === 'build_team' || role === 'group_admin') {
      navigate('/portail/delivery', { replace: true })
    } else {
      navigate('/portail', { replace: true })
    }
  }

  return (
    <div className="portal-demo-bar">
      <span className="portal-demo-bar-label">{t.demo_label}</span>
      <select className="portal-demo-bar-select" value={user.id} onChange={handleChange}>
        {sortedProfiles.map(p => (
          <option key={p.id} value={p.id}>
            {profileDemoOptionLabel(p, t)}
          </option>
        ))}
      </select>
    </div>
  )
}
