// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// vitest tourne depuis frontend/ (racine du projet vite).
const SRC = readFileSync(resolve(process.cwd(), 'public/boot-guard.js'), 'utf8')

let reload
function boot({ load = true } = {}) {
  reload = vi.fn()
  // Doubles pour window / location / navigator : aucun écouteur ne survit d'un test à l'autre.
  const win = new EventTarget()
  win.sessionStorage = sessionStorage
  new Function('window', 'location', 'navigator', SRC)(win, { reload }, { language: 'fr-FR' })
  if (load) win.dispatchEvent(new Event('load'))
}
const splash = () => document.querySelector('[data-boot-splash]')

beforeEach(() => {
  vi.useFakeTimers()
  sessionStorage.clear()
  document.body.innerHTML = '<div id="root"></div>'
})
afterEach(() => { vi.useRealTimers() })

describe('garde-fou de démarrage (public/boot-guard.js)', () => {
  it('application montée : ni message ni rechargement, compteur remis à zéro', () => {
    sessionStorage.setItem('cfao-boot-retries', '3')
    boot()
    document.getElementById('root').innerHTML = '<main>app</main>'
    vi.advanceTimersByTime(10000)
    expect(reload).not.toHaveBeenCalled()
    expect(document.querySelector('[data-boot-guard]')).toBeNull()
    expect(sessionStorage.getItem('cfao-boot-retries')).toBeNull()
  })

  it('page restée vide : « Mise à jour en cours… » puis rechargement compté', () => {
    boot()
    vi.advanceTimersByTime(4000)
    expect(document.querySelector('[role="status"]').textContent).toContain('Mise à jour en cours')
    expect(reload).not.toHaveBeenCalled()
    vi.advanceTimersByTime(3000)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem('cfao-boot-retries')).toBe('1')
  })

  it('l’application finit par monter pendant le message : pas de rechargement', () => {
    boot()
    vi.advanceTimersByTime(4000)
    document.getElementById('root').innerHTML = '<main>app</main>'
    vi.advanceTimersByTime(3000)
    expect(reload).not.toHaveBeenCalled()
  })

  it('modules encore en chargement : indicateur visible, aucun rechargement', () => {
    boot({ load: false })
    expect(splash()).toBeNull()
    vi.advanceTimersByTime(400)
    expect(splash().textContent).toContain('Chargement')
    vi.advanceTimersByTime(30000)
    expect(reload).not.toHaveBeenCalled()
    expect(document.getElementById('root').childNodes.length).toBe(0)
  })

  it('indicateur retiré dès que l’application monte', () => {
    boot({ load: false })
    vi.advanceTimersByTime(400)
    document.getElementById('root').innerHTML = '<main>app</main>'
    vi.advanceTimersByTime(800)
    expect(splash()).toBeNull()
  })

  it('application montée avant le délai : pas d’indicateur', () => {
    boot({ load: false })
    document.getElementById('root').innerHTML = '<main>app</main>'
    vi.advanceTimersByTime(1000)
    expect(splash()).toBeNull()
  })

  it('load jamais reçu (module sans réponse) : message puis rechargement', () => {
    boot({ load: false })
    vi.advanceTimersByTime(60000)
    expect(reload).not.toHaveBeenCalled()
    vi.advanceTimersByTime(4300)
    expect(document.querySelector('[data-boot-guard]').textContent).toContain('Mise à jour en cours')
    expect(splash()).toBeNull()
    vi.advanceTimersByTime(3000)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('trop d’essais : plus de boucle, un bouton « Recharger »', () => {
    sessionStorage.setItem('cfao-boot-retries', '8')
    boot()
    vi.advanceTimersByTime(20000)
    expect(reload).not.toHaveBeenCalled()
    const btn = document.querySelector('[data-boot-guard] button')
    expect(btn.textContent).toBe('Recharger')
    btn.click()
    expect(reload).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem('cfao-boot-retries')).toBeNull()
  })
})
