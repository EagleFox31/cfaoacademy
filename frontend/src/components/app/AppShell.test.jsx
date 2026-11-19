// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import AppShell from './AppShell.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const NAV = [
  { group: 'Personnes', items: [
    { id: 'accounts', ico: '◉', label: 'Comptes', to: '/a', count: 12 },
    { id: 'roles', ico: '⚿', label: 'Rôles', to: '/r' },
  ] },
  { group: 'Contenu', items: [{ id: 'articles', ico: '✎', label: 'Articles', to: '/x' }] },
]

let host, root
function monter(props = {}) {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => {
    root.render(
      <MemoryRouter>
        <AppShell brand={{ badge: 'SA', title: 'CFAO Academy', subtitle: 'Administration' }}
          nav={NAV} activeId="roles" title="Rôles" back={{ to: '/portail', label: 'Retour au portail' }} {...props}>
          <p>contenu</p>
        </AppShell>
      </MemoryRouter>,
    )
  })
}
afterEach(() => { act(() => root.unmount()); host.remove() })

const lien = texte => [...host.querySelectorAll('a')].find(a => a.textContent.includes(texte))

describe('AppShell', () => {
  it('rend les groupes, les entrées et le contenu', () => {
    monter()
    expect(host.textContent).toContain('Personnes')
    expect(host.textContent).toContain('Contenu')
    expect(host.querySelector('h1').textContent).toBe('Rôles')
    expect(host.querySelector('.dlv-view').textContent).toBe('contenu')
  })

  it('marque l\'entrée active pour les lecteurs d\'écran', () => {
    monter()
    const actif = lien('Rôles')
    expect(actif.getAttribute('aria-current')).toBe('page')
    expect(actif.className).toContain('is-active')
    expect(lien('Comptes').getAttribute('aria-current')).toBeNull()
  })

  it('affiche le compteur et le lien retour', () => {
    monter()
    expect(lien('Comptes').textContent).toContain('12')
    expect(lien('Retour au portail').getAttribute('href')).toBe('/portail')
  })
})
