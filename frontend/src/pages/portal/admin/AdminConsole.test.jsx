// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCopy } from '../../../i18n/index.js'
import { ADMIN_MODULE_IDS, adminPath } from '../../../utils/adminAccess.js'

vi.mock('../../../hooks/useSiteEffects', () => ({ default: () => {} }))
vi.mock('../../../hooks/usePortalBackground', () => ({ default: () => {} }))
vi.mock('../../../components/LocaleSwitch', () => ({ default: () => null }))
const ETAT = { user: null, lang: 'fr', resource: { data: null, status: 'offline' } }
vi.mock('../../../hooks/useAuth', () => ({ default: () => ({ user: ETAT.user, status: 'ready' }) }))
vi.mock('../../../hooks/useLocale', () => ({
  default: s => ({ t: getCopy(s, ETAT.lang), locale: ETAT.lang, setLocale: () => {} }),
}))
vi.mock('../../../hooks/useAdminResource', () => ({
  default: () => ETAT.resource,
  fetchAllUsers: () => Promise.resolve([]),
  fetchAllPages: () => Promise.resolve([]),
}))

const { default: AdminConsole } = await import('./AdminConsole.jsx')
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const SUPERADMIN = { id: 's1', roles: ['superadmin'], firstName: 'Awa', lastName: 'Diop' }

let host, root
async function show(path, { user = SUPERADMIN, lang = 'fr', resource } = {}) {
  ETAT.user = user
  ETAT.lang = lang
  ETAT.resource = resource ?? { data: null, status: 'offline' }
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/portail" element={<p>PORTAIL</p>} />
          <Route path="/portail/admin" element={<AdminConsole />} />
          <Route path="/portail/admin/:module" element={<AdminConsole />} />
        </Routes>
      </MemoryRouter>,
    )
  })
}
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('console d\'administration', () => {
  it('renvoie au portail un compte qui n\'est pas super admin', async () => {
    await show('/portail/admin', { user: { roles: ['dps'] } })
    expect(host.textContent).toBe('PORTAIL')
  })

  it('ramène un module inconnu à la vue d\'ensemble', async () => {
    await show('/portail/admin/inconnu')
    expect(host.querySelector('h1').textContent).toBe(getCopy('admin', 'fr').title_overview)
  })

  it.each(['fr', 'en', 'pt'])('chaque module s\'affiche sans texte manquant (%s)', async lang => {
    const t = getCopy('admin', lang)
    for (const id of ADMIN_MODULE_IDS) {
      await show(adminPath(id), { lang })
      expect(host.querySelector('h1').textContent).toBe(t[`title_${id}`])
      expect(host.querySelector('.dlv-nav-item.is-active')?.getAttribute('href')).toBe(adminPath(id))
      expect(host.textContent).not.toMatch(/undefined|NaN/)
      act(() => root.unmount()); host.remove()
    }
    await show(adminPath())
  })

  it('dit pourquoi la liste des comptes manque, sans rien inventer', async () => {
    await show(adminPath('accounts'))
    expect(host.textContent).toContain(getCopy('admin', 'fr').state_offline)
    expect(host.querySelector('table')).toBeNull()
  })

  it('montre les comptes avec leurs rôles en clair, jamais les codes', async () => {
    const users = [{ id: 'u1', email: 'a@x.io', first_name: 'Awa', last_name: 'Diop', roles: ['dps'], scope_paths: ['groupe'] }]
    await show(adminPath('accounts'), { resource: { data: users, status: 'ready' } })
    const row = host.querySelector('tbody tr')
    expect(row.textContent).toContain('Awa Diop')
    expect(row.textContent).toContain(getCopy('portal', 'fr').role_dps)
    expect(row.textContent).toContain(getCopy('admin', 'fr').branch_group)
    expect(row.textContent).not.toMatch(/\bdps\b/)
  })
})
