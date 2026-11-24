// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LocaleProvider } from '../../context/LocaleProvider.jsx'
import fr from '../../i18n/locales/fr/portal.json'
import en from '../../i18n/locales/en/portal.json'
import pt from '../../i18n/locales/pt/portal.json'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
globalThis.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } }

const { authMock, comptesMock } = vi.hoisted(() => ({ authMock: vi.fn(), comptesMock: vi.fn() }))
vi.mock('../../hooks/useAuth', () => ({ default: () => authMock() }))
vi.mock('../../lib/api', () => ({ api: { userRoleCounts: () => comptesMock() }, URL_SUGGESTIONS: '/api/v1/core/suggestions' }))
vi.mock('../../components/Nav', () => ({ default: () => <nav data-testid="nav" /> }))
vi.mock('../../components/Footer', () => ({ default: () => null }))
vi.mock('../../components/PortalDemoBar', () => ({ default: () => null }))
// Effets visuels (fond, apparition, animation d'entrée) hors sujet ici.
vi.mock('../../hooks/useSiteEffects', () => ({ default: () => {} }))
vi.mock('../../hooks/usePortalReveal', () => ({ default: () => {} }))
vi.mock('../../hooks/usePortalBackground', () => ({ default: () => {} }))
vi.mock('../../hooks/useBrandDetailEntrance.js', () => ({ default: () => {}, animateBrandDetailExit: async () => {} }))

const { default: Page } = await import('./CenterProfilePortalsDetail.jsx')
const { GROUPES_PROFILS, medacapDuProfil, PROFILS_ATTENDUS, PROFILS_EXCLUS } = await import('../../utils/profilsPortails.js')

let racine = null
let hote = null
afterEach(() => {
  act(() => racine?.unmount())
  hote?.remove()
  racine = hote = null
})

const UTILISATEUR = {}
const rendre = (roles, reponse = Promise.resolve({ counts: {} })) => {
  comptesMock.mockReset().mockReturnValue(reponse)
  Object.assign(UTILISATEUR, { id: 'u1', roles, firstName: 'Laurent' })
  authMock.mockReturnValue({ status: 'ready', user: UTILISATEUR })
  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
  act(() => racine.render(
    <LocaleProvider>
      <MemoryRouter initialEntries={['/portail/centre/portails']}>
        <Routes>
          <Route path="/portail/centre/portails" element={<Page />} />
          <Route path="/portail" element={<p data-testid="portail">portail</p>} />
        </Routes>
      </MemoryRouter>
    </LocaleProvider>,
  ))
}

describe('Portails des profils (directeur du centre)', () => {
  it('chaque profil de la plateforme est rangé une fois, hors super admin, build et directeur du centre', () => {
    const ranges = GROUPES_PROFILS.flatMap(g => g.roles.map(r => r.role))
    expect(new Set(ranges).size).toBe(ranges.length)
    expect([...ranges].sort()).toEqual([...PROFILS_ATTENDUS].sort())
    PROFILS_EXCLUS.forEach(r => expect(ranges).not.toContain(r))
  })

  it('libellés présents dans les trois langues', () => {
    const cles = [
      ...GROUPES_PROFILS.map(g => `dir_portails_groupe_${g.id}`),
      ...GROUPES_PROFILS.flatMap(g => g.roles.map(r => `dir_portails_perim_${r.perimetre}`)),
      ...GROUPES_PROFILS.flatMap(g => g.roles.map(r => `role_${r.role}`)),
      'dir_portails_title', 'dir_portails_lead', 'dir_portails_col_comptes', 'dir_portails_cta', 'dir_portails_bientot', 'dir_portails_close',
    ]
    for (const langue of [fr, en, pt]) cles.forEach(c => expect(langue[c], c).toBeTruthy())
  })

  it('le directeur voit la navbar, le titre et un tableau par groupe, accès au portail à venir', () => {
    rendre(['center_director'])
    const page = hote.querySelector('[data-testid="portails-profils"]')
    expect(hote.querySelector('[data-testid="nav"]')).toBeTruthy()
    expect(page.querySelector('h1').textContent).toBe('Portails des profils')
    expect(page.querySelector('[data-testid="portails-suggestion"]').textContent).toContain('« Proposer une modification »')
    expect(page.querySelectorAll('table')).toHaveLength(GROUPES_PROFILS.length)
    expect(page.textContent).toContain(`Les ${PROFILS_ATTENDUS.length} profils de la plateforme, classés en ${GROUPES_PROFILS.length} groupes`)
    expect([...page.querySelectorAll('table')[0].querySelectorAll('th')].map(th => th.textContent))
      .toEqual(['Profil', 'Comptes', 'Son périmètre', 'Ce qu’il voit de MEDACAP', 'Portail'])
    expect(page.textContent).toContain('Coordinateur formations')
    const boutons = [...page.querySelectorAll('tbody .portal-portails-cta')]
    expect(boutons).toHaveLength(PROFILS_ATTENDUS.length)
  })

  it('« Voir son portail » : ouvert au directeur pour chaque profil', () => {
    rendre(['center_director'])
    const ouverts = [...hote.querySelectorAll('[data-testid^="voir-"]')].map(a => a.dataset.testid)
    expect(ouverts).toHaveLength(PROFILS_ATTENDUS.length)
    expect(hote.querySelectorAll('tbody .portal-portails-cta[aria-disabled="true"]')).toHaveLength(0)
    const lien = hote.querySelector('[data-testid="voir-training_coordinator"]')
    expect(lien.getAttribute('href')).toBe('/portail?apercu=training_coordinator')
    const ouvrir = vi.spyOn(window, 'open').mockReturnValue({ focus() {} })
    act(() => lien.click())
    expect(ouvrir).toHaveBeenCalledWith('/portail?apercu=training_coordinator', 'apercu-training_coordinator', expect.stringContaining('popup=yes'))
    ouvrir.mockRestore()
  })

  it('MEDACAP : 7 lettres par profil de la matrice, éteintes sans fonctionnalité, DOP comme DPS', () => {
    rendre(['center_director'])
    const lettres = role => [...hote.querySelectorAll(`[data-testid="medacap-${role}"] button`)]
    expect(lettres('dps').map(b => b.textContent).join('')).toBe('MEDACAP')
    expect(lettres('dps').map(b => !b.disabled)).toEqual([false, true, true, false, false, false, true])
    expect(lettres('dop').map(b => !b.disabled)).toEqual(lettres('dps').map(b => !b.disabled))
    expect(lettres('learner').map(b => !b.disabled)).toEqual([true, true, true, true, true, false, true])
    for (const r of ['pic', 'technical_expert']) expect(lettres(r).map(b => !b.disabled)).toEqual(lettres('ki').map(b => !b.disabled))
    expect(hote.querySelector('[data-testid="comptes-center_director"]')).toBeTruthy()
    expect(hote.textContent).toContain('Expert Technique')
    expect(lettres('trainer').map(b => !b.disabled)).toEqual([false, true, false, true, true, false, true])
    expect(lettres('center_director').map(b => !b.disabled)).toEqual([false, true, true, true, false, false, true])
    expect(lettres('branch_admin').map(b => !b.disabled)).toEqual(lettres('branch_hr').map(b => !b.disabled))
    expect(hote.textContent).not.toContain('Non renseigné')
  })

  it('MEDACAP : une lettre allumée ouvre la sous-ligne de ses fonctionnalités, un second clic la referme', () => {
    rendre(['center_director'])
    const lettre = (role, i) => hote.querySelectorAll(`[data-testid="medacap-${role}"] button`)[i]
    const detail = () => hote.querySelector('[data-testid="medacap-detail-dps"]')
    expect(detail()).toBeNull()
    act(() => lettre('dps', 1).click())
    expect(detail().querySelector('p').textContent).toBe('Exploiter : ce que voit le profil Dir. Pièces & Services')
    expect([...detail().querySelectorAll('li')].map(li => li.textContent))
      .toEqual(['Résultats par collaborateur', 'Résultats par niveau'])
    expect(lettre('dps', 1).getAttribute('aria-expanded')).toBe('true')
    act(() => lettre('dps', 6).click())
    expect(detail().querySelector('p').textContent).toContain('Performer')
    act(() => lettre('dps', 6).click())
    expect(detail()).toBeNull()
  })

  it('chaque profil a un « ? » qui donne sa description, dans les trois langues', () => {
    rendre(['center_director'])
    const roles = GROUPES_PROFILS.flatMap(g => g.roles.map(r => r.role))
    for (const langue of [fr, en, pt]) roles.forEach(r => expect(langue[`dir_portails_desc_${r}`], r).toBeTruthy())
    roles.forEach(r => {
      const aide = hote.querySelector(`[data-testid="aide-${r}"]`)
      expect(aide.querySelector('.portal-portails-bulle').textContent).toBe(fr[`dir_portails_desc_${r}`])
      expect(aide.getAttribute('aria-label')).toContain(fr[`dir_portails_desc_${r}`])
      expect(aide.tabIndex).toBe(0)
    })
  })

  it('l’apprenant est nommé « Apprenant ou Technicien », le directeur du centre voit aussi les filiales', () => {
    rendre(['center_director'])
    const ligne = role => hote.querySelector(`[data-testid="comptes-${role}"]`).closest('tr')
    expect(ligne('learner').querySelector('strong').textContent).toBe('Apprenant ou Technicien')
    expect(ligne('center_director').children[2].textContent).toBe('Le centre de formation et toutes les filiales')
    expect(ligne('training_coordinator').children[2].textContent).toBe('Le centre de formation')
    for (const langue of [fr, en, pt]) expect(langue.dir_portails_nom_learner).toBeTruthy()
  })

  it('MEDACAP : chaque fonctionnalité de la matrice a son libellé dans les trois langues', () => {
    const ids = GROUPES_PROFILS.flatMap(g => g.roles)
      .flatMap(r => medacapDuProfil(r.role) ?? []).flatMap(e => e.fonctions)
    expect(ids.length).toBeGreaterThan(0)
    for (const langue of [fr, en, pt]) {
      ids.forEach(id => expect(langue[`dir_portails_fonc_${id}`], id).toBeTruthy())
      ;['col_medacap', 'medacap_inconnu', 'medacap_ouvrir', 'medacap_sans', 'medacap_detail']
        .forEach(c => expect(langue[`dir_portails_${c}`], c).toBeTruthy())
    }
  })

  it('le nombre de comptes de chaque profil vient de l’API, 0 quand le profil est absent', async () => {
    rendre(['center_director'], Promise.resolve({ counts: { dps: 12, trainer: 7 } }))
    await act(async () => {})
    const nb = role => hote.querySelector(`[data-testid="comptes-${role}"]`).textContent
    expect(nb('dps')).toBe('12')
    expect(nb('trainer')).toBe('7')
    expect(nb('learner')).toBe('0')
    expect(comptesMock).toHaveBeenCalledTimes(1)
  })

  it('sans réponse de l’API, « — » et jamais de chiffre inventé', async () => {
    rendre(['center_director'], Promise.reject(new Error('403')))
    await act(async () => {})
    const cellules = [...hote.querySelectorAll('[data-testid^="comptes-"]')]
    expect(cellules).toHaveLength(PROFILS_ATTENDUS.length)
    cellules.forEach(c => expect(c.textContent).toBe('—'))
  })

  it("un autre profil est renvoyé vers son portail, sans appel du comptage", () => {
    rendre(['dps'])
    expect(hote.querySelector('[data-testid="portails-profils"]')).toBeNull()
    expect(hote.querySelector('[data-testid="portail"]')).toBeTruthy()
    expect(comptesMock).not.toHaveBeenCalled()
  })
})
