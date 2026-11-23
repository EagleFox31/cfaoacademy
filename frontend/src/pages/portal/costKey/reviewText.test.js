import { describe, expect, it } from 'vitest'
import fr from '../../../i18n/locales/fr/costKey.json'
import { reviewText } from './reviewText'

describe('reviewText', () => {
  it('signale une place sans date au coordinateur', () => {
    const text = reviewText(fr, 'fr-FR', {
      issue: 'no_date', code: 'LVL15', country_label: 'Burkina Faso', seats: 3,
      start_date: null, end_date: null, assignee: '',
    })
    expect(text).toContain('À dater : LVL15 (Burkina Faso, places : 3)')
  })
})
