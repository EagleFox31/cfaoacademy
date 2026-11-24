import { useMemo } from 'react'
import AdminState, { PendingAction } from './AdminState'
import { roleCounts, roleLabel } from '../../../../utils/adminAccounts'

export default function RolesModule({ t, tPortal, users, roles }) {
  const catalog = roles.data ?? []
  const counts = useMemo(() => roleCounts(users.data ?? []), [users.data])
  const rows = useMemo(
    () => catalog
      .map(r => ({ code: r.code, label: roleLabel(r.code, { tPortal, tAdmin: t, catalog }), n: counts[r.code] ?? 0 }))
      .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)),
    [catalog, counts, tPortal, t],
  )

  if (roles.status !== 'ready') return <AdminState status={roles.status} t={t} />

  return (
    <>
      <div className="dlv-toolbar">
        <p className="adm-muted">{t.roles_rules_note}</p>
        <span className="adm-actions"><PendingAction label={t.action_grant} t={t} /></span>
      </div>
      {rows.length === 0 ? <AdminState status="ready" empty t={t} /> : (
        <table className="dlv-table">
          <thead><tr><th>{t.col_role}</th><th>{t.col_holders}</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.code}>
                <td>{r.label}</td>
                <td>
                  {users.status === 'ready' ? r.n : <span className="adm-muted">{users.status === 'loading' ? t.state_loading : '–'}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
