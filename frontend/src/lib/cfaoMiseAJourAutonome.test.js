// @vitest-environment jsdom
// Fichier autonome partagé avec les autres modules (frontend/partage/cfao-mise-a-jour.js).
import fs from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const SOURCE = fs.readFileSync(path.resolve(process.cwd(), 'partage/cfao-mise-a-jour.js'), 'utf8')

function charger(json, ok = true) {
  delete window.CfaoMiseAJour
  document.body.innerHTML = ''
  window.fetch = vi.fn().mockResolvedValue({ ok, json: async () => json })
  window.eval(SOURCE)
  return window.CfaoMiseAJour
}

const attendre = () => new Promise((r) => setTimeout(r, 0))
const bouton = (texte) => [...document.querySelectorAll('button')].find((b) => b.textContent === texte)

beforeEach(() => sessionStorage.clear())

describe('cfao-mise-a-jour.js (autonome)', () => {
  it('porte son numéro de version en en-tête et dans l’objet exposé', () => {
    const entete = /cfao-mise-a-jour\.js — version (\d+\.\d+\.\d+)/.exec(SOURCE)?.[1]
    expect(entete).toBe(charger({}).VERSION)
  })

  it('aucune adresse en dur : sans url, il ne lit rien', () => {
    expect(SOURCE).not.toMatch(/https?:\/\//)
    charger({ build: 'b2' }).demarrer({ module: 'cr', build: 'b1' })
    expect(window.fetch).not.toHaveBeenCalled()
  })

  it('nouveau build : bandeau ; « Plus tard » le ferme et le fait taire', async () => {
    const m = charger({ module: 'cr', version: '1.5.0', build: 'b2' })
    m.demarrer({ url: '/cr/version.json', module: 'cr', version: '1.4.0', build: 'b1', langue: 'fr' })
    await attendre()
    expect(window.fetch.mock.calls[0][0]).toMatch(/^\/cr\/version\.json\?t=\d+$/)
    const barre = document.querySelector('[role="status"]')
    expect(barre.textContent).toContain('Une nouvelle version est disponible')
    expect(barre.textContent).not.toContain('1.5.0')
    expect(bouton('Plus tard').title).toContain('30 minutes')
    expect(document.documentElement.classList.contains('cfao-nv-actif')).toBe(true)
    bouton('Plus tard').click()
    expect(document.querySelector('[role="status"]')).toBeNull()
    expect(document.documentElement.classList.contains('cfao-nv-actif')).toBe(false)
    m.verifier()
    await attendre()
    expect(document.querySelector('[role="status"]')).toBeNull()
  })

  it('même build, autre module, ou échec : silence', async () => {
    charger({ module: 'cr', build: 'b1' }).demarrer({ url: '/cr/version.json', module: 'cr', build: 'b1' })
    await attendre()
    charger({ module: 'needs', build: 'b2' }).demarrer({ url: '/x', module: 'cr', build: 'b1' })
    await attendre()
    charger({}, false).demarrer({ url: '/x', module: 'cr', build: 'b1' })
    await attendre()
    expect(document.body.textContent).toBe('')
  })

  it('client sous min_client : modale sans « Plus tard », en anglais', async () => {
    charger({ build: 'b2', min_client: '2.0.0' })
      .demarrer({ url: '/x', module: 'planning', version: '1.9.9', build: 'b1', langue: 'en' })
    await attendre()
    expect(document.querySelector('[role="alertdialog"]').textContent).toContain('Update required')
    expect(bouton('Later')).toBeUndefined()
  })

  it('garde puis rend les saisies autour du rechargement', () => {
    const m = charger({})
    m.registerBeforeReload('brouillon', () => ({ texte: 'a' }))
    const recharger = vi.fn()
    Object.defineProperty(window, 'location', { value: { reload: recharger }, configurable: true })
    m.actualiser()
    expect(recharger).toHaveBeenCalledOnce()
    const restaurer = vi.fn()
    charger({}).registerAfterReload('brouillon', restaurer)
    expect(restaurer).toHaveBeenCalledWith({ texte: 'a' })
  })
})
