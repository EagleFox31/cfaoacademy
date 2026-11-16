import { describe, it, expect } from 'vitest'
import { empreinte, etatTexte, poserRediges } from './empreintes'

const avant = empreinte({ taux: 95 })
const apres = empreinte({ taux: 83 })

describe('empreintes des textes rediges', () => {
  it('depend des chiffres, pas de l’instant', () => {
    expect(empreinte({ taux: 95 })).toBe(avant)
    expect(apres).not.toBe(avant)
  })

  it('distingue texte a jour, a reecrire, retouche et inconnu', () => {
    const b = {
      textes: { a: 'Acquisition 95 %', r: 'Acquisition 95 %, bien', x: 'libre' },
      empreintes: {
        a: { chiffres: avant, texte: 'Acquisition 95 %' },
        r: { chiffres: avant, texte: 'Acquisition 95 %' },
      },
    }
    expect(etatTexte(b, 'a', avant)).toBe('a-jour')
    expect(etatTexte(b, 'a', apres)).toBe('a-reecrire')
    expect(etatTexte(b, 'r', apres)).toBe('perime')
    expect(etatTexte(b, 'x', apres)).toBe('inconnu')
  })

  it('reecrit un texte non retouche et garde un texte retouche entre-temps', () => {
    const b = {
      textes: { a: 'Acquisition 95 %', r: 'retouche pendant la redaction' },
      empreintes: {
        a: { chiffres: avant, texte: 'Acquisition 95 %' },
        r: { chiffres: avant, texte: 'Acquisition 95 %' },
      },
    }
    const suite = poserRediges(b, {
      a: { texte: 'Acquisition 83 %', chiffres: apres },
      r: { texte: 'Acquisition 83 %', chiffres: apres },
      n: { texte: 'neuf', chiffres: apres },
    })
    expect(suite.textes).toEqual({ a: 'Acquisition 83 %', r: 'retouche pendant la redaction', n: 'neuf' })
    expect(suite.empreintes.a).toEqual({ chiffres: apres, texte: 'Acquisition 83 %' })
    expect(suite.empreintes.r.chiffres).toBe(avant)
    expect(suite.empreintes.n.chiffres).toBe(apres)
  })
})
