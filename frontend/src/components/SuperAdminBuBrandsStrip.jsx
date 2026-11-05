import { useMemo } from 'react'

export const SUPERADMIN_EQUIPMENT_BRANDS = [
  { id: 'renault-trucks', name: 'Renault Trucks', logo: '/assets/logos/renault-trucks.png' },
  { id: 'hino',           name: 'Hino',           logo: '/assets/logos/hino.png' },
  { id: 'fuso',           name: 'Fuso',           logo: '/assets/logos/fuso.png' },
  { id: 'sinotruk',       name: 'Sinotruk',       logo: '/assets/logos/sinotruk.png' },
  { id: 'shacman',        name: 'Shacman',        logo: '/assets/logos/shacman.png' },
  { id: 'mercedes-trucks',name: 'Mercedes Trucks',logo: '/assets/logos/mercedes.png' },
  { id: 'king-long',      name: 'King Long',      logo: '/assets/logos/kinglong.png' },
  { id: 'bt',             name: 'BT',             logo: '/assets/logos/bt.png' },
  { id: 'toyota-forklift',name: 'Toyota Material',logo: '/assets/logos/toyota-forklift.png' },
  { id: 'jcb',            name: 'JCB',            logo: '/assets/logos/jcb.png' },
  { id: 'lovol',          name: 'Lovol',          logo: '/assets/logos/lovol.png' },
]

export const SUPERADMIN_MOTORS_BRANDS = [
  { id: 'toyota',         name: 'Toyota',         logo: '/assets/logos/toyota.png' },
  { id: 'mercedes',       name: 'Mercedes-Benz',  logo: '/assets/logos/mercedes.png' },
  { id: 'suzuki',         name: 'Suzuki',         logo: '/assets/logos/suzuki.png' },
  { id: 'byd',            name: 'BYD',            logo: '/assets/logos/byd.png' },
  { id: 'mitsubishi',     name: 'Mitsubishi',     logo: '/assets/logos/mitsubishi.png' },
  { id: 'omoda',          name: 'Omoda & Jaecoo', logo: '/assets/logos/omoda.png' },
  { id: 'stellantis',     name: 'Stellantis',     logo: '/assets/logos/stellantis.png' },
  { id: 'citroen',        name: 'Citroën',        logo: '/assets/logos/citroen.png' },
  { id: 'yamaha',         name: 'Yamaha',         logo: '/assets/logos/yamaha.png' },
]

export const SUPERADMIN_FILIALES_DATA = [
  { filiale: 'Cameroun',             countryCode: 'cm', flagSrc: '/assets/flags/cameroon.svg',                      all: 271, motors: 186, equipment: 141, bu: ['equipment', 'motors'] },
  { filiale: "Côte d'Ivoire",        countryCode: 'ci', flagSrc: '/assets/flags/ivory-coast.svg',                   all: 220, motors: 152, equipment: 114, bu: ['equipment', 'motors'] },
  { filiale: 'RDC',                  countryCode: 'cd', flagSrc: '/assets/flags/democratic-republic-of-congo.svg', all: 39,  motors: 28,  equipment: 21,  bu: ['equipment', 'motors'] },
  { filiale: 'Togo',                 countryCode: 'tg', flagSrc: '/assets/flags/togo.svg',                          all: 37,  motors: 26,  equipment: 20,  bu: ['equipment', 'motors'] },
  { filiale: 'Madagascar',           countryCode: 'mg', flagSrc: '/assets/flags/madagascar.svg',                    all: 35,  motors: 24,  equipment: 19,  bu: ['equipment', 'motors'] },
  { filiale: 'Sénégal',              countryCode: 'sn', flagSrc: '/assets/flags/senegal.svg',                       all: 34,  motors: 24,  equipment: 18,  bu: ['equipment', 'motors'] },
  { filiale: 'Tchad',                countryCode: 'td', flagSrc: '/assets/flags/chad.svg',                          all: 34,  motors: 23,  equipment: 18,  bu: ['equipment', 'motors'] },
  { filiale: 'Centrafrique (RCA)',   countryCode: 'cf', flagSrc: '/assets/flags/central-african-republic.svg',      all: 34,  motors: 23,  equipment: 18,  bu: ['equipment', 'motors'] },
  { filiale: 'Gabon',                countryCode: 'ga', flagSrc: '/assets/flags/gabon.svg',                          all: 31,  motors: 21,  equipment: 17,  bu: ['equipment', 'motors'] },
  { filiale: 'Guinée Équatoriale',   countryCode: 'gq', flagSrc: '/assets/flags/equatorial-guinea.svg',             all: 28,  motors: 19,  equipment: 15,  bu: ['equipment', 'motors'] },
  { filiale: 'Burkina Faso',         countryCode: 'bf', flagSrc: '/assets/flags/burkina-faso.svg',                  all: 22,  motors: 15,  equipment: 12,  bu: ['equipment', 'motors'] },
  { filiale: 'Congo',                countryCode: 'cg', flagSrc: '/assets/flags/congo.svg',                         all: 19,  motors: 13,  equipment: 10,  bu: ['equipment', 'motors'] },
  { filiale: 'Guinée-Conakry',       countryCode: 'gn', flagSrc: '/assets/flags/guinea.svg',                        all: 20,  motors: 14,  equipment: 11,  bu: ['equipment', 'motors'] },
  { filiale: 'Nigeria',              countryCode: 'ng', flagSrc: '/assets/flags/nigeria.svg',                       all: 15,  motors: 11,  equipment: 8,   bu: ['equipment', 'motors'] },
  { filiale: 'Mauritanie',           countryCode: 'mr', flagSrc: '/assets/flags/mauritania.svg',                    all: 14,  motors: 10,  equipment: 8,   bu: ['equipment', 'motors'] },
  { filiale: 'Bénin',                countryCode: 'bj', flagSrc: '/assets/flags/benin.svg',                         all: 13,  motors: 9,   equipment: 7,   bu: ['equipment', 'motors'] },
  { filiale: 'Mali',                 countryCode: 'ml', flagSrc: '/assets/flags/mali.svg',                          all: 13,  motors: 9,   equipment: 7,   bu: ['equipment', 'motors'] },
  { filiale: 'Rwanda',               countryCode: 'rw', flagSrc: '/assets/flags/rwanda.svg',                        all: 11,  motors: 11,  equipment: 0,   bu: ['motors'] },
]

/**
 * Adapte la shape API `filiales_learners` (backend cfao-core analytics) vers la
 * shape attendue par ce composant.
 *
 *   API : { displayName, countryCode, all, motors, equipment }
 *   UI  : { filiale, countryCode, flagSrc, all, motors, equipment, bu[] }
 *
 * `flagSrc` est dérivé du countryCode (convention `/assets/flags/{code}.svg`).
 * `bu` est dérivé de `motors > 0` / `equipment > 0` — utile pour le filtre.
 */
function adaptApiFiliales(apiFiliales) {
  return apiFiliales
    .map(f => ({
      filiale:     f.displayName,
      countryCode: f.countryCode,
      flagSrc:     f.countryCode ? `/assets/flags/${f.countryCode}.svg` : null,
      all:         Number(f.all)       || 0,
      motors:      Number(f.motors)    || 0,
      equipment:   Number(f.equipment) || 0,
      bu:          [
        f.equipment > 0 ? 'equipment' : null,
        f.motors    > 0 ? 'motors'    : null,
      ].filter(Boolean),
    }))
}

/**
 * Bandeau interactif Super Admin :
 * Affiche soit les logos des marques, soit les drapeaux des filiales avec leur nombre de techniciens apprenants.
 * Le nombre de techniciens par filiale s'adapte automatiquement à la Business Unit active (Toutes BU, Equipment, Motors).
 *
 * @param {Array} [filiales] — payload API `filiales_learners` du hook super admin.
 *   Fallback silencieux sur `SUPERADMIN_FILIALES_DATA` (const historique) si absent
 *   ou vide, pour préserver la résilience dev/mock.
 */
export default function SuperAdminBuBrandsStrip({
  activeBu = 'all',
  mode = 'marques',
  filiales = null,
}) {
  const brands = useMemo(() => {
    if (activeBu === 'equipment') return SUPERADMIN_EQUIPMENT_BRANDS
    if (activeBu === 'motors') return SUPERADMIN_MOTORS_BRANDS
    return [...SUPERADMIN_EQUIPMENT_BRANDS, ...SUPERADMIN_MOTORS_BRANDS]
  }, [activeBu])

  const filialesSource = useMemo(() => {
    if (Array.isArray(filiales) && filiales.length > 0) return adaptApiFiliales(filiales)
    return SUPERADMIN_FILIALES_DATA
  }, [filiales])

  const resolvedFiliales = useMemo(() => {
    return filialesSource
      .filter(item => {
        if (activeBu === 'all') return true
        return item.bu.includes(activeBu)
      })
      .map(item => {
        const count = activeBu === 'equipment'
          ? item.equipment
          : activeBu === 'motors'
            ? item.motors
            : item.all

        return {
          ...item,
          apprenantsCount: count,
        }
      })
  }, [activeBu, filialesSource])

  return (
    <div className="portal-superadmin-brands-band">
      {mode === 'filiales' ? (
        <div className="portal-superadmin-filiales-row" role="list">
          {resolvedFiliales.map((f, idx) => (
            <div
              key={f.countryCode || f.filiale}
              role="listitem"
              className="portal-superadmin-filiale-chip"
              style={{ animationDelay: `${idx * 16}ms` }}
              title={`${f.filiale} : ${f.apprenantsCount} techniciens apprenants (${activeBu === 'equipment' ? 'Pôle Equipment' : activeBu === 'motors' ? 'Pôle Motors' : 'Toutes BU'})`}
              onClick={() => {
                const el = document.getElementById('branches')
                el?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              <div className="portal-superadmin-filiale-flag-box">
                <img
                  src={f.flagSrc || `/assets/flags/${f.countryCode}.svg`}
                  alt={`Drapeau ${f.filiale}`}
                  className="portal-superadmin-filiale-flag-img"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
              <div className="portal-superadmin-filiale-info">
                <span className="portal-superadmin-filiale-name">{f.filiale}</span>
                <span className="portal-superadmin-filiale-count">
                  <strong>{f.apprenantsCount}</strong> {f.apprenantsCount > 1 ? 'techniciens' : 'technicien'}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="portal-superadmin-brands-row" role="list">
          {brands.map((b, idx) => (
            <div
              key={b.id}
              role="listitem"
              className="portal-superadmin-brand-chip"
              style={{ animationDelay: `${idx * 22}ms` }}
              title={b.name}
            >
              <img
                src={b.logo}
                alt={b.name}
                className="portal-superadmin-brand-chip-img"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
