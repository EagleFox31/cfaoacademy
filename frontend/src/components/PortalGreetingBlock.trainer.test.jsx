// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCopy } from '../i18n/index.js'

vi.mock('./AnimatedCount.jsx', () => ({ default: ({ value }) => <>{value}</> }))
vi.mock('../hooks/useLocale', () => ({ default: s => ({ t: getCopy(s, 'fr'), locale: 'fr' }) }))

const { default: PortalGreetingBlock } = await import('./PortalGreetingBlock.jsx')
globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root
afterEach(() => { act(() => root.unmount()); host.remove() })

function phrase(centerHero) {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(
    <PortalGreetingBlock greetingKey="Bonjour" firstName="Eugène" user={{ roles: ['trainer'] }}
      primaryRole="trainer" hideOrient centerHero={centerHero} />,
  ))
  return host.querySelector('.portal-header-dps-stats').textContent.replace(/\s+/g, ' ').trim()
}

describe('haut de page du formateur', () => {
  it('dit sur combien de marques il forme, au singulier comme au pluriel', () => {
    expect(phrase({ mode: 'trainer', brands: 1 })).toBe('À l’Academy, vous formez les techniciens CFAO sur 1 marque')
    expect(phrase({ mode: 'trainer', brands: 2 })).toBe('À l’Academy, vous formez les techniciens CFAO sur 2 marques')
  })

  it('phrase chiffrée générique (RH) : chiffres en grand, noms en mots, titre sans virgule doublée', () => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    act(() => root.render(
      <PortalGreetingBlock greetingKey="Bonjour" firstName="Aminata" user={{ roles: ['branch_hr'] }}
        primaryRole="branch_hr" hideOrient statsHero={{
          gabarit: 'Vous suivez {techs} {techs_mot} et {cands} {cands_mot} en recrutement',
          chiffres: { techs: 40, techs_mot: 'techniciens CFAO', cands: 1, cands_mot: 'candidat' },
        }} />,
    ))
    const ligne = host.querySelector('.portal-header-dps-stats')
    expect(ligne.textContent.replace(/\s+/g, ' ').trim())
      .toBe('Vous suivez 40 techniciens CFAO et 1 candidat en recrutement')
    expect([...ligne.querySelectorAll('.portal-header-dps-stat')].map(s => s.textContent)).toEqual(['40', '1'])
    expect(host.querySelector('h1').textContent.replace(/\s+/g, ' ').trim()).toBe('Bonjour Aminata,')
  })

  it('en aperçu, la salutation ne nomme pas celui qui regarde', () => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    const titre = () => host.querySelector('h1').textContent.replace(/\s+/g, ' ').trim()
    act(() => root.render(
      <PortalGreetingBlock greetingKey="Bon après-midi" firstName="Laurent" primaryRole="center_assistant" hideOrient
        user={{ roles: ['center_assistant'], apercu: 'center_assistant' }} centerHero={{ mode: 'assistant', countries: 35, brands: 22 }} />,
    ))
    expect(titre()).toBe('Bon après-midi,')
    act(() => root.render(
      <PortalGreetingBlock greetingKey="Bonjour" firstName="Laurent" primaryRole="learner" hideOrient
        user={{ roles: ['learner'], apercu: 'learner' }} />,
    ))
    expect(titre()).toBe('Bonjour!')
    expect(host.textContent).not.toContain('Laurent')
  })

  it('phrase chiffrée générique : nombre inconnu = « — », jamais de chiffre inventé', () => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    act(() => root.render(
      <PortalGreetingBlock greetingKey="Bonjour" firstName="Aminata" user={{ roles: ['branch_hr'] }}
        primaryRole="branch_hr" hideOrient statsHero={{
          gabarit: 'Vous suivez {techs} {techs_mot} travaillant sur {marques} {marques_mot}',
          chiffres: { techs: 15, techs_mot: 'techniciens CFAO', marques: null, marques_mot: 'marques' },
        }} />,
    ))
    expect(host.querySelector('.portal-header-dps-stats').textContent.replace(/\s+/g, ' ').trim())
      .toBe('Vous suivez 15 techniciens CFAO travaillant sur — marques')
  })

  it('le directeur garde sa phrase avec les pays', () => {
    expect(phrase({ mode: 'director', countries: 23, brands: 22 }))
      .toBe('À l’Academy, vous pilotez la stratégie de formation de 23 pays sur 22 marques')
  })
})
