import { useParams, Link } from 'react-router-dom'
import MedacapDashboard from '../../components/medacap/MedacapDashboard.jsx'
import useAuth from '../../hooks/useAuth'
import useLocale from '../../hooks/useLocale'
import { LMS_BY_USER } from '../../data/mock_lms'
import { MEDACAP_PROFILE_CONFIG } from '../../config/medacapMatrix.js'

/**
 * Route : /portail/preview/:profileKey
 *
 * Prévisualisation d'un dashboard profil via le renderer paramétré, en mode
 * `preview = true` (affiche même les sections idea/draft avec un bandeau de statut).
 * Accessible depuis SuperAdminBuilderDashboard. Le super admin voit à quoi
 * ressemblera le portail final.
 */
export default function MedacapProfilePreview() {
  const { profileKey } = useParams()
  const { user } = useAuth()
  const { t } = useLocale('portal')

  if (!user) return null
  const lms = LMS_BY_USER[user.demoKey]
  const cfg = MEDACAP_PROFILE_CONFIG[profileKey]

  if (!cfg) {
    return (
      <div className="container" style={{ padding: 32 }}>
        Profil <code>{profileKey}</code> introuvable.{' '}
        <Link to="/portail">Retour portail</Link>
      </div>
    )
  }

  return (
    <>
      <div className="medacap-preview-topbar">
        <span>
          {t.builder_preview_topbar_label ?? 'Preview'} · <strong>{profileKey}</strong>
        </span>
        <Link to="/portail/admin/builder" className="portal-btn portal-btn-ghost">
          ← {t.builder_back_to_builder ?? 'Retour au builder'}
        </Link>
      </div>
      <MedacapDashboard
        profileKey={profileKey}
        user={user}
        lms={lms}
        t={t}
        preview
        respectBuildState={false}
      />
    </>
  )
}
