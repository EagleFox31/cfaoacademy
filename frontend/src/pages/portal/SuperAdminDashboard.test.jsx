// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { LocaleProvider } from '../../context/LocaleProvider.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
globalThis.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } }

// Super admin connecté par OIDC : aucun demoKey, donc aucune donnée de démonstration.
const { statsMock, comptesMock } = vi.hoisted(() => ({
  statsMock: vi.fn(() => ({ stats: null })),
  comptesMock: vi.fn(() => ({ data: [], status: 'ready' })),
}))
vi.mock('../../hooks/useAdminResource.js', () => ({ default: (...a) => comptesMock(...a), fetchAllUsers: () => null }))

vi.mock('../../lib/auth.js', async importOriginal => ({ ...(await importOriginal()), OIDC_ACTIF: true }))
vi.mock('../../hooks/useAuth', () => ({
  default: () => ({ user: { id: 'u1', roles: ['superadmin'], role: 'superadmin', firstName: 'Admin' } }),
}))
vi.mock('../../hooks/useSuperadminGroupStats.js', () => ({ default: (...a) => statsMock(...a) }))
vi.mock('../../hooks/useDeliveryState.js', () => ({ default: () => ({ stories: [] }) }))
vi.mock('../../components/ApercuVuComme.jsx', () => ({ default: () => null }))
vi.mock('../../components/PortalLayout.jsx', () => ({
  default: ({ lms, children }) => (
    <div data-testid="portail">
      <pre data-testid="kpis">{JSON.stringify(lms?.globalKpis ?? null)}</pre>
      {children}
    </div>
  ),
}))

const { default: SuperAdminDashboard, LMS_VIDE } = await import('./SuperAdminDashboard.jsx')
const { ROLES_APERCU } = await import('../../utils/apercuPortail.js')

let racine = null
let hote = null
afterEach(() => {
  act(() => racine?.unmount())
  hote?.remove()
  racine = hote = null
})

const rendre = () => {
  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
  act(() => racine.render(
    <LocaleProvider><MemoryRouter><SuperAdminDashboard /></MemoryRouter></LocaleProvider>,
  ))
}
const screen = { getByTestId: id => hote.querySelector(`[data-testid="${id}"]`) }

describe('SuperAdminDashboard en OIDC (sans demoKey)', () => {
  it('affiche le portail même avant la réponse de group-stats (plus de page vide)', () => {
    statsMock.mockReturnValue({ stats: null })
    rendre()
    expect(screen.getByTestId('portail')).toBeTruthy()
    expect(JSON.parse(screen.getByTestId('kpis').textContent)).toEqual({})
  })

  it("ne montre que les chiffres de l'API, jamais ceux du mock", () => {
    statsMock.mockReturnValue({
      stats: { learnerCount: 12, branchCount: 3, brandCount: 4, trainingCount: 5, trainingYear: 2026 },
    })
    rendre()
    expect(JSON.parse(screen.getByTestId('kpis').textContent)).toEqual({
      totalApprenants: 12, filialesActives: 3, brandsCount: 4, sessionsActives: 5, trainingYear: 2026,
    })
  })

  it.each([
    [null, 'bloqué', true],
    [{ focus() {} }, 'nouvelle fenêtre', false],
  ])('clic sur une carte de profil : un message, jamais de silence (open → %o)', (fenetre, texte, lien) => {
    const ouvrir = vi.spyOn(window, 'open').mockReturnValue(fenetre)
    rendre()
    const carte = hote.querySelector('#apercus button.pv-card')
    expect(carte).toBeTruthy()
    act(() => carte.click())
    expect(ouvrir).toHaveBeenCalledWith(expect.stringMatching(/^\/portail\?apercu=/), expect.any(String), expect.stringContaining('popup'))
    const retour = screen.getByTestId('apercu-retour')
    expect(retour.textContent).toContain(texte)
    expect(Boolean(retour.querySelector('a[href^="/portail?apercu="]'))).toBe(lien)
    // Aucun compte réel de ce rôle : on le dit, aperçu avec les droits du super admin.
    expect(retour.textContent).toContain('Aucun compte')
    ouvrir.mockRestore()
  })

  it("carte d'un profil : ouvre le premier compte réel du rôle par nom, jamais un super admin", () => {
    const role = ROLES_APERCU[0]
    comptesMock.mockReturnValue({
      status: 'ready',
      data: [
        { id: 'aaaaaaaa-0000-4000-8000-000000000001', first_name: 'Zoé', last_name: 'Bilong', roles: [role] },
        { id: 'AAAAAAAA-0000-4000-8000-000000000002', first_name: 'Alain', last_name: 'Abena', roles: [role] },
        { id: 'aaaaaaaa-0000-4000-8000-000000000003', first_name: 'Aaron', last_name: 'Admin', roles: [role, 'superadmin'] },
      ],
    })
    const ouvrir = vi.spyOn(window, 'open').mockReturnValue({ focus() {} })
    rendre()
    act(() => hote.querySelector('#apercus button.pv-card').click())
    expect(ouvrir).toHaveBeenCalledWith(
      `/portail?apercu=${role}&cible=aaaaaaaa-0000-4000-8000-000000000002`, expect.any(String), expect.stringContaining('popup'),
    )
    const retour = screen.getByTestId('apercu-retour').textContent
    expect(retour).toContain('Alain Abena')
    expect(retour).not.toContain('Aucun compte')
    ouvrir.mockRestore()
    comptesMock.mockReturnValue({ data: [], status: 'ready' })
  })

  it('profils opérationnels : formateur et directeur du centre sont deux cartes distinctes', () => {
    rendre()
    const texte = hote.querySelector('#profiles').textContent
    expect(texte).not.toContain('Formateur & Directeur Centre')
    expect(texte).toContain('Directeur du centre de formation')
  })

  it('la base OIDC est vide', () => {
    expect(LMS_VIDE.globalKpis).toEqual({})
    expect(LMS_VIDE.filialesStats).toEqual([])
  })
})
