import { describe, expect, it } from 'vitest'
import { getCopy, LOCALES } from '../../../i18n/index.js'
import { validateConfig } from './schema.js'
import trainer from './configs/trainer.js'
import consultation from './configs/consultation.js'
import assistant from './configs/assistant.js'

// Chaque config de portail : ids uniques, étapes MEDACAP valides, clés de
// texte présentes en fr, en et pt.
const CONFIGS = [trainer, consultation, assistant]

describe.each(CONFIGS.map(c => [c.key, c]))('config du portail %s', (_, config) => {
  it('valide dans toutes les langues', () => {
    expect(validateConfig(config, { copy: getCopy, locales: LOCALES })).toEqual([])
  })
})
