const BRAND_TO_MARQUE = {
  toyota: 'TOYOTA',
  mercedes: 'MERCEDES',
  suzuki: 'SUZUKI',
  byd: 'BYD',
  mitsubishi: 'MITSUBISHI',
  stellantis: 'STELLANTIS',
  fuso: 'FUSO',
  hino: 'HINO',
}

function inferNiveau(code) {
  const c = (code ?? '').trim()
  if (!c || c === '—' || c === '-') return ''
  const m = c.match(/(G[1-4]|N[1-5]|BEV\d*|BEV|CERTIFIED|Step\s*\d+|FTIR\d*|TSA\d*)/i)
  return m ? m[1].replace(/\s+/g, ' ') : ''
}

/** Convertit une session LMS portail → forme SessionCard (accueil). */
export function normalizePortalSession(raw) {
  const marque = raw.marque ?? BRAND_TO_MARQUE[(raw.brand ?? '').toLowerCase()] ?? raw.brand?.toUpperCase()

  return {
    uid: raw.id,
    id: raw.id,
    date: raw.date,
    fin: raw.fin,
    jours: raw.jours ?? 1,
    niveau: raw.niveau ?? inferNiveau(raw.code),
    formateur: raw.formateur?.trim() ?? '',
    code: raw.code,
    nom: raw.title,
    marque,
    lieu: raw.lieu,
    bu: raw.bu ?? 'Techniques Motors',
    tagClass: raw.tagClass ?? 'motors',
    type: raw.type ?? 'Présentiel',
    annualStatus: raw.annualStatus,
  }
}
