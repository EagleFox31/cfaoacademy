// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../components/Nav', () => ({ default: () => null }))
vi.mock('../../../components/Footer', () => ({ default: () => null }))
vi.mock('../../../components/PortalDemoBar', () => ({ default: () => null }))
vi.mock('../../../components/PortalStickyBar', () => ({ default: () => null }))
vi.mock('../../../components/PortalHeader', () => ({ default: () => <p id="entete-standard" /> }))
vi.mock('../../../components/PortalAssistanceSection.jsx', () => ({ default: ({ variant }) => <p id={`assistance-${variant}`} /> }))
vi.mock('../../../components/PortalReveal.jsx', () => ({
  default: ({ id, children }) => <section id={id}>{children}</section>,
}))
vi.mock('../../../components/PortalStaggerGrid.jsx', () => ({ default: ({ children }) => <div>{children}</div> }))
vi.mock('../../../hooks/useSiteEffects', () => ({ default: () => {} }))
vi.mock('../../../hooks/usePortalBackground', () => ({ default: () => {} }))
vi.mock('../../../hooks/usePortalHeaderHeight.js', () => ({ default: () => {} }))
vi.mock('../../../hooks/useAjustementEcran.js', () => ({ default: () => {} }))
const ETAT = { user: { id: 'u1', roles: ['demo'] } }
vi.mock('../../../hooks/useAuth', () => ({ default: () => ({ user: ETAT.user, status: 'ready' }) }))
const DICOS = {
  demo: {
    eb: 'Surtitre', ti: 'Titre', chip: 'en attente', carte: 'Carte', meta: 'Méta', vide: 'Rien',
    cta: 'Ouvrir', bientot: 'Bientôt', suivre: 'À suivre', admin: 'Admin',
  },
  portal: { eb_p: 'Surtitre portail', ti_p: 'Titre portail' },
}
vi.mock('../../../hooks/useLocale', () => ({ default: ns => ({ t: DICOS[ns] ?? {}, locale: 'fr' }) }))

const { default: RolePortal } = await import('./RolePortal.jsx')
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const CONFIG = {
  key: 'demo', ns: 'demo', viewportSection: 'prio', assistance: { variant: 'learner' },
  construction: { label: 'bientot', chip: 'suivre' },
  sections: [
    { id: 'prio', kind: 'priorities', etape: null, head: { eyebrow: 'portal:eb_p', title: 'portal:ti_p' },
      cards: [
        { id: 'a', count: 'nombre', chip: { key: 'chip' }, title: 'carte', meta: 'meta', metaEmpty: 'vide',
          cta: 'cta', link: { section: 'riche', ifCount: true } },
        { id: 'b', count: 0, chip: { key: 'chip' }, title: 'carte', meta: 'meta', metaEmpty: 'vide', cta: 'cta' },
        { id: 'admin', count: null, chip: { key: 'chip' }, title: 'admin', visibleIf: { roles: ['superadmin'] } },
      ] },
    { id: 'chantier', kind: 'construction', etape: 'acquerir', head: { eyebrow: 'eb', title: 'ti' },
      cards: [{ id: 'c', title: 'carte', meta: 'meta' }] },
    { id: 'riche', kind: 'rich', render: 'liste', etape: 'acquerir', head: { eyebrow: 'eb', title: 'ti' },
      visibleIf: { selector: 'aDesElements' } },
    { id: 'libre', kind: 'rich', render: 'libre', wrap: false, etape: 'mesurer' },
  ],
}
const SELECTORS = { aDesElements: ctx => ctx.roles.includes('demo') }
const RICH = {
  liste: ({ values }) => <ul className="riche">{values.elements.map(e => <li key={e}>{e}</li>)}</ul>,
  libre: ({ section }) => <article id={section.id}>libre</article>,
}
const useSources = () => ({ values: { nombre: 2, elements: ['x', 'y'] }, loading: false })

let host, root
async function rendu(props = {}) {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => {
    root.render(<MemoryRouter>
      <RolePortal config={CONFIG} useSources={useSources} selectors={SELECTORS} rich={RICH} {...props} />
    </MemoryRouter>)
  })
}
afterEach(() => { act(() => root.unmount()); host.remove(); ETAT.user = { id: 'u1', roles: ['demo'] } })

describe('RolePortal', () => {
  it('rend les sections visibles dans l’ordre de la config, ancres comprises', async () => {
    await rendu()
    expect([...host.querySelectorAll('section[id], article[id]')].map(s => s.id))
      .toEqual(['prio', 'chantier', 'riche', 'libre'])
    expect(host.querySelector('#entete-standard')).not.toBeNull()
    expect(host.querySelector('#assistance-learner')).not.toBeNull()
  })

  it('textes du profil et du namespace portal', async () => {
    await rendu()
    const prio = host.querySelector('section#prio')
    expect(prio.querySelector('.portal-section-eyebrow').textContent).toBe('Surtitre portail')
    expect(host.querySelector('section#chantier .portal-section-title').textContent).toBe('Titre')
  })

  it('compteur : nombre dans la pastille, 0 = done avec méta vide et sans lien', async () => {
    await rendu()
    const chips = [...host.querySelectorAll('section#prio .portal-status-chip')]
    expect(chips.map(c => [c.className, c.textContent])).toEqual([
      ['portal-status-chip alert', '2 en attente'],
      ['portal-status-chip done', '0 en attente'],
    ])
    expect(host.querySelector('section#prio').textContent).toContain('Rien')
  })

  it('section en construction : visuel de chantier, aucun lien', async () => {
    await rendu()
    const s = host.querySelector('section#chantier')
    expect(s.querySelector('.portal-construction-media')).not.toBeNull()
    expect(s.textContent).toContain('À suivre')
    expect(s.querySelector('a')).toBeNull()
  })

  it('section riche : enveloppée, ou porteuse de son ancre avec wrap: false', async () => {
    await rendu()
    expect([...host.querySelectorAll('section#riche .riche li')].map(l => l.textContent)).toEqual(['x', 'y'])
    expect(host.querySelector('section#riche .portal-section-title')).not.toBeNull()
    expect(host.querySelector('article#libre').textContent).toBe('libre')
  })

  it('visibleIf : rôles et sélecteur', async () => {
    ETAT.user = { id: 'u2', roles: ['autre', 'superadmin'] }
    await rendu()
    expect(host.querySelector('section#riche')).toBeNull()
    expect(host.querySelector('section#prio').textContent).toContain('Admin')
  })

  it('observateur : ni CTA ni coin, même avec un lien', async () => {
    await rendu({ config: { ...CONFIG, observer: true } })
    const prio = host.querySelector('section#prio')
    expect(prio.querySelector('.corner')).toBeNull()
    expect(prio.textContent).not.toContain('Ouvrir')
  })
})
