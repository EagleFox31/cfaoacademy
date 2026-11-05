const SPECIAL_DATE_KEYS = {
  '12-25': 'greeting_xmas',
  '01-01': 'greeting_newyear',
  '12-31': 'greeting_nye',
}

/** Clé i18n portal — salutation selon l'heure locale (+ fêtes fixes). */
export function computePortalGreetingKey(date = new Date()) {
  const hour = date.getHours()
  const mmdd = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

  const specialKey = SPECIAL_DATE_KEYS[mmdd]
  if (specialKey) return specialKey

  if (hour >= 5 && hour < 12) return 'greeting_morning'
  if (hour >= 12 && hour < 18) return 'greeting_afternoon'
  return 'greeting_evening'
}
