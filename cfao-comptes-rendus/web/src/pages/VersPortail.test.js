import { describe, expect, it } from 'vitest'

import { quitteLeModule } from './VersPortail'

const ORIGINE = 'https://192.168.10.155:8445'

describe('quitteLeModule', () => {
  it('pas de portail : on reste dans le module', () => {
    expect(quitteLeModule(null, '/cr/', ORIGINE)).toBe(false)
  })
  it('cible dans /cr/ : pas de redirection (boucle)', () => {
    expect(quitteLeModule('/cr/portail', '/cr/', ORIGINE)).toBe(false)
  })
  it('chemin /portail de la même origine : on quitte le module', () => {
    expect(quitteLeModule('/portail#sessions', '/cr/', ORIGINE)).toBe(true)
  })
  it('autre origine (portail sur un autre port) : on quitte le module', () => {
    expect(quitteLeModule('https://192.168.10.155:8446/', '/cr/', ORIGINE)).toBe(true)
  })
  it('adresse invalide : on reste', () => {
    expect(quitteLeModule('http://', '/cr/', ORIGINE)).toBe(false)
  })
})
