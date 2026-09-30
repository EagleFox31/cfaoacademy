import { describe, expect, it } from 'vitest'
import { facteurAjustement } from './useAjustementEcran.js'

describe('facteurAjustement', () => {
  it('ne touche pas un contenu qui tient', () => {
    expect(facteurAjustement(800, 500)).toBe(1)
  })

  it('réduit juste assez un contenu qui dépasse un peu', () => {
    const f = facteurAjustement(700, 750)
    expect(f).toBeLessThan(1)
    expect(f * 750).toBeLessThanOrEqual(700)
  })

  it('ne réduit jamais la section de plus de 15 %', () => {
    expect(facteurAjustement(300, 800)).toBe(0.85)
  })

  it('ne descend pas sous le seuil de lecture, interface déjà réduite comprise', () => {
    // Interface à 0,8 : le texte est déjà au seuil, la section n'est plus réduite.
    expect(facteurAjustement(300, 800, 0.8)).toBe(1)
    expect(facteurAjustement(300, 800, 0.9) * 0.9).toBeGreaterThanOrEqual(0.8 - 1e-9)
  })

  it('sans mesure fiable, laisse la taille normale', () => {
    expect(facteurAjustement(0, 500)).toBe(1)
    expect(facteurAjustement(NaN, 500)).toBe(1)
  })
})
