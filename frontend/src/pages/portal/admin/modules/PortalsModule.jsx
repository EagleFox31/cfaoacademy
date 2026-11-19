import { Fragment, useMemo, useState } from 'react'
import { PendingAction } from './AdminState'
import { PORTAL_NAV_SECTIONS } from '../../../../data/index.js'
import { getCopy } from '../../../../i18n/index.js'
import { PORTAL_CONFIGS } from '../../roleportal/configs/index.js'
import { portalMatrix, profilesInFactory } from '../../roleportal/matrix.js'
import { roleLabel } from '../../../../utils/adminAccounts'

const STAGE_KEYS = {
  mesurer: 'medacap_stage_measure',
  exploiter: 'medacap_stage_exploit',
  definir: 'medacap_stage_define',
  acquerir: 'medacap_stage_acquire',
  certifier: 'medacap_stage_certify',
  appliquer: 'medacap_stage_apply',
  performer: 'medacap_stage_perform',
}

const ALL_PROFILES = Object.keys(PORTAL_NAV_SECTIONS)

function cellText(cell, t) {
  if (cell.state === 'locked') return t[cell.reason === 'observer' ? 'cell_locked_observer' : 'cell_locked_role']
  return t[`cell_${cell.state}`]
}

export default function PortalsModule({ t, tPortal, locale, roles }) {
  const [profile, setProfile] = useState('all')
  const catalog = roles.data ?? []
  const label = code => roleLabel(code, { tPortal, tAdmin: t, catalog })

  const columns = profile === 'all' ? profilesInFactory(PORTAL_CONFIGS, ALL_PROFILES) : [profile]
  const groups = useMemo(() => portalMatrix(PORTAL_CONFIGS, columns), [columns.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps
  const rowLabel = row => getCopy(row.ns, locale)?.[row.labelKey] ?? getCopy(row.ns, 'fr')?.[row.labelKey] ?? ''

  return (
    <>
      <div className="dlv-toolbar">
        <select className="dlv-field" value={profile} onChange={e => setProfile(e.target.value)} aria-label={t.filter_profile}>
          <option value="all">{t.filter_all_profiles}</option>
          {ALL_PROFILES.map(p => <option key={p} value={p}>{label(p)}</option>)}
        </select>
        <span className="adm-actions">
          <PendingAction label={t.action_toggle} t={t} />
          <PendingAction label={t.action_preview} t={t} />
        </span>
      </div>
      <p className="dlv-hint">{t.portals_note}</p>

      <div className="adm-scroll">
        <table className="dlv-table adm-matrix">
          <thead>
            <tr>
              <th>{t.col_section}</th>
              {columns.map(p => <th key={p}>{label(p)}</th>)}
            </tr>
          </thead>
          <tbody>
            {groups.map(g => (
              <Fragment key={g.etape}>
                <tr className="adm-stage">
                  <td colSpan={columns.length + 1}>{STAGE_KEYS[g.etape] ? tPortal[STAGE_KEYS[g.etape]] : t.stage_other}</td>
                </tr>
                {g.rows.map(row => (
                  <tr key={row.nodeId} className={row.level ? 'adm-row-card' : undefined}>
                    <td>{rowLabel(row)}</td>
                    {columns.map(p => {
                      const cell = row.cells[p]
                      return (
                        <td key={p} className="adm-cell">
                          <span className={`adm-cell-tag ${cell.state}`}>{cellText(cell, t)}</span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
