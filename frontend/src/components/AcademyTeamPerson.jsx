import { useState } from 'react'
import AcademyTeamBrandStack from './AcademyTeamBrandStack.jsx'
import { flagForSessionLieu, flagCdnUrl } from '../utils/sessionLieuFlag.js'

function initialsFromName(name) {
  if (!name) return '?'
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function AcademyTeamPerson({
  name,
  role,
  note,
  lieu,
  lieuLabel,
  photo,
  silhouette,
  brands,
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const showPhoto = Boolean(photo) && !silhouette && !imgFailed
  const flag = lieu ? flagForSessionLieu(lieu) : null
  const displayLieu = lieuLabel ?? lieu
  const flagLabel = flag && displayLieu ? displayLieu : flag?.label

  return (
    <article className="academy-team-person">
      <div className="academy-team-person-main">
        <div
          className={`academy-team-person-avatar${silhouette ? ' is-silhouette' : ''}${showPhoto ? ' has-photo' : ''}`}
        >
          {showPhoto ? (
            <img src={photo} alt="" loading="lazy" onError={() => setImgFailed(true)} />
          ) : (
            <span aria-hidden="true">{silhouette ? '○' : initialsFromName(name)}</span>
          )}
        </div>
        <div className="academy-team-person-body">
          <div className="academy-team-person-name-row">
            <h4 className="academy-team-person-name">{name}</h4>
            {flag ? (
              <img
                src={flagCdnUrl(flag.code, 40)}
                srcSet={`${flagCdnUrl(flag.code, 80)} 2x`}
                alt={flagLabel ?? ''}
                className="academy-team-person-flag"
                loading="lazy"
              />
            ) : displayLieu ? (
              <span className="academy-team-person-lieu--text">{displayLieu}</span>
            ) : null}
            {note ? <span className="academy-team-person-note">({note})</span> : null}
          </div>
          <p className="academy-team-person-role">{role}</p>
        </div>
      </div>
      <AcademyTeamBrandStack brands={brands} />
    </article>
  )
}
