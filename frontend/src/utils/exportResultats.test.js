import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import ExcelJS from 'exceljs'
import { construireClasseurResultats, nomFichierResultats } from './exportResultats'

const modele = readFileSync(new URL('../../public/modeles/resultats.xlsx', import.meta.url))

const stagiaire = i => ({
  id: `p${i}`, nom: `Nom${i}`, prenom: `Prenom${i}`, pays: 'Cameroun',
  entreeBrut: String(10 + i), sortieTheoBrut: '27', sortiePratBrut: i === 2 ? '' : '15',
})
const brouillon = n => ({
  intitule: 'Diagnostic des Systèmes électriques', debut: '2026-08-03', fin: '2026-08-07',
  participants: Array.from({ length: n }, (_, i) => stagiaire(i + 1)),
})

async function lire(n, extra = {}) {
  const wb = await construireClasseurResultats(ExcelJS, modele, { ...brouillon(n), ...extra }, null)
  const tampon = await wb.xlsx.writeBuffer()
  const relu = new ExcelJS.Workbook()
  await relu.xlsx.load(tampon)
  return relu.worksheets[0]
}

describe('classeur Résultats', () => {
  it('pose une ligne par stagiaire et la moyenne juste dessous (petit groupe)', async () => {
    const ws = await lire(5)
    expect(ws.getCell('B2').value).toBe('Résultats Diagnostic des Systèmes électriques du 03-07.08.26')
    expect(ws.getCell('C5').value).toBe('NOM1 PRENOM1')
    expect(ws.getCell('D5').value).toBe('CFAO MOBILITY CAMEROUN')
    expect(ws.getCell('I6').value).toBe('-')
    expect(ws.getCell('B10').value).toBe('SCORE MOYEN GENERAL DES PARTICIPANTS')
    expect(ws.getCell('E10').value.formula).toBe('AVERAGE(E5:E9)')
    expect(ws.getCell('C11').value).toBe('Légende :')
    expect(ws.getCell('B18').value ?? null).toBeNull()
  })

  it('garde la disposition du modèle à treize stagiaires', async () => {
    const ws = await lire(13)
    expect(ws.getCell('B18').value).toBe('SCORE MOYEN GENERAL DES PARTICIPANTS')
    expect(ws.getCell('C19').value).toBe('Légende :')
    expect(ws.getCell('K5').value.formula).toBe('IFERROR((H5-F5)/F5,"")')
  })

  it('agrandit le tableau au-delà de treize stagiaires', async () => {
    const ws = await lire(16)
    expect(ws.getCell('C20').value).toBe('NOM16 PRENOM16')
    expect(ws.getCell('B21').value).toBe('SCORE MOYEN GENERAL DES PARTICIPANTS')
    expect(ws.getCell('L21').value.formula).toBe('AVERAGE(L5:L20)')
    expect(ws.getCell('C22').value).toBe('Légende :')
    expect(ws.model.merges).toContain('B21:D21')
    expect(ws.model.merges).not.toContain('B18:D18')
    const refs = ws.conditionalFormattings.map(c => c.ref).join(' ')
    expect(refs).toContain('H5:H20')
    expect(refs).not.toContain('17')
  })

  it('suit les barèmes de la session', async () => {
    const ws = await lire(2, { baremes: { entreeTheorique: 20, sortieTheorique: 25, sortiePratique: 10 } })
    expect(ws.getCell('E4').value).toBe("Test d'entrée theorique/20")
    expect(ws.getCell('F5').value.formula).toBe('IF(E5="-",0,E5/20)')
    expect(ws.getCell('J5').value.formula).toBe('IF(I5="-",0,I5/10)')
  })

  it('nomme le fichier comme ceux des formateurs', () => {
    expect(nomFichierResultats(brouillon(1), null))
      .toBe('Résultats Diagnostic des Systèmes électriques du 03-07.08.26.xlsx')
  })

  it('le modèle ne porte aucun nom ni aucune note', async () => {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(modele)
    const ws = wb.worksheets[0]
    for (let r = 5; r <= 17; r++) for (const c of 'CDEGI') expect(ws.getCell(`${c}${r}`).value ?? null).toBeNull()
  })
})

describe('import du classeur Résultats', () => {
  it('relit ce que l’export a écrit', async () => {
    const { lireResultats } = await import('./importEvaluation')
    const wb = await construireClasseurResultats(ExcelJS, modele, brouillon(4), null)
    const tampon = await wb.xlsx.writeBuffer()
    const fichier = { arrayBuffer: async () => tampon }
    const { stagiaires } = await lireResultats(fichier)
    expect(stagiaires).toHaveLength(4)
    expect(stagiaires[0].nom).toBe('NOM1 PRENOM1')
    expect(stagiaires[0].pays).toBeTruthy()
    expect(stagiaires[0].entree).toBeCloseTo(11 / 30)
    expect(stagiaires[0].pratique).toBeCloseTo(15 / 20)
    expect(stagiaires[1].pratique).toBeNull()
  })
})
