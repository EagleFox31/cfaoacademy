import { useMemo, useState } from 'react'
import AdminState, { PendingAction } from './AdminState'
import {
  branchLabel, displayName, filterAccounts, plural, roleLabel,
} from '../../../../utils/adminAccounts'

export default function AccountsModule({ t, tPortal, users, roles, units }) {
  const [q, setQ] = useState('')
  const [role, setRole] = useState('all')
  const list = users.data ?? []
  const catalog = roles.data ?? []
  const label = code => roleLabel(code, { tPortal, tAdmin: t, catalog })

  const rows = useMemo(() => filterAccounts(list, { q, role }), [list, q, role])
  const roleOptions = useMemo(
    () => [...new Set(list.flatMap(u => u.roles ?? []))].sort((a, b) => label(a).localeCompare(label(b))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list, catalog, tPortal, t],
  )

  if (users.status !== 'ready') return <AdminState status={users.status} t={t} />

  return (
    <>
      <div className="dlv-toolbar">
        <input type="search" className="dlv-field dlv-field--search" value={q}
          onChange={e => setQ(e.target.value)} placeholder={t.search_placeholder} aria-label={t.search_placeholder} />
        <select className="dlv-field" value={role} onChange={e => setRole(e.target.value)} aria-label={t.filter_role}>
          <option value="all">{t.filter_all_roles}</option>
          {roleOptions.map(code => <option key={code} value={code}>{label(code)}</option>)}
        </select>
        <span className="adm-muted">{plural(t, 'count_accounts', rows.length)}</span>
        <span className="adm-actions"><PendingAction label={t.action_create_account} t={t} /></span>
      </div>

      {rows.length === 0 ? <AdminState status="ready" empty t={t} /> : (
        <div className="adm-scroll">
          <table className="dlv-table">
            <thead>
              <tr><th>{t.col_name}</th><th>{t.col_email}</th><th>{t.col_roles}</th><th>{t.col_branch}</th></tr>
            </thead>
            <tbody>
              {rows.map(u => (
                <tr key={u.id ?? u.email}>
                  <td>{displayName(u)}</td>
                  <td>{u.email}</td>
                  <td>
                    {(u.roles ?? []).length === 0
                      ? <span className="adm-muted">{t.no_role}</span>
                      : <span className="adm-tags">{u.roles.map(r => <span key={r} className="dlv-chip">{label(r)}</span>)}</span>}
                  </td>
                  <td>{branchLabel(u.scope_paths, units.data ?? [], t.branch_group)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
