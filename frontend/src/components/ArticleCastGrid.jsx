import { flagForCastLieu } from '../utils/castFlag.js'

/** Portraits nom + rôle pour articles événement / formation. */
export default function ArticleCastGrid({ title, people = [] }) {
  if (!people.length) return null
  return (
    <figure className="article-cast">
      {title && <figcaption className="article-cast-title">{title}</figcaption>}
      <div className="article-cast-grid">
        {people.map(({ name, role, lieu, photo }) => {
          const flag = flagForCastLieu(lieu)
          return (
            <div key={name} className="article-cast-card">
              <div className="article-cast-photo">
                <img src={photo} alt="" loading="lazy" />
              </div>
              <div className="article-cast-body">
                <strong className="article-cast-name">
                  {flag && (
                    <img
                      src={flag.src}
                      srcSet={flag.srcSet}
                      alt=""
                      className="article-cast-flag"
                      loading="lazy"
                    />
                  )}
                  <span>{name}</span>
                </strong>
                <span className="article-cast-role">{role}</span>
              </div>
            </div>
          )
        })}
      </div>
    </figure>
  )
}
