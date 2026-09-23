import { useEffect, useRef, useState } from 'react'

/**
 * L'image reelle de la diapositive, convertie depuis le modele.
 *
 * Le formateur doit voir la page telle qu'elle sortira de PowerPoint,
 * pas une reconstitution HTML qui s'en approche. Le service convertit
 * donc la vraie diapositive du modele, drapeaux remplis.
 *
 * La conversion prend une a trois secondes ; le cache du service rend
 * les suivantes immediates. Pendant qu'une nouvelle page se prepare,
 * l'ancienne image disparait : la garder affichee laissait croire que
 * la modification en cours etait deja visible, alors que ce n'etait
 * pas encore le cas. Un cadre neutre et un indicateur centre — icone
 * qui tourne, texte — disent sans ambiguite qu'une nouvelle version
 * arrive.
 *
 * Si le service ne repond pas, on le dit et on laisse la main au rendu
 * HTML : mieux vaut un apercu approchant que pas d'apercu du tout.
 */
export default function ApercuReel({ diapo, valeurs, secours }) {
  const [image, setImage] = useState(null)
  const [etat, setEtat] = useState('attente')
  const dernier = useRef(0)

  useEffect(() => {
    if (!diapo) return undefined
    const marque = ++dernier.current
    let annule = false
    let url = null

    // L'image affichee ne correspond plus : elle s'efface tout de suite,
    // sans attendre la fin du differe — sinon la page precedente resterait
    // visible le temps qu'il s'ecoule.
    setEtat('chargement')

    // Laisser retomber la frappe avant de convertir : sans cela chaque
    // caractere lancerait une conversion.
    const minuteur = setTimeout(async () => {
      try {
        const r = await fetch('/apercu/page', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ diapo, valeurs }),
        })
        if (!r.ok) throw new Error(String(r.status))
        const blob = await r.blob()
        if (annule || marque !== dernier.current) return
        url = URL.createObjectURL(blob)
        setImage(ancien => {
          if (ancien) URL.revokeObjectURL(ancien)
          return url
        })
        setEtat('pret')
      } catch {
        if (!annule) setEtat('indisponible')
      }
    }, 400)

    return () => {
      annule = true
      clearTimeout(minuteur)
    }
  }, [diapo, valeurs])

  if (etat === 'indisponible') {
    return (
      <div className="cr-apercu-reel cr-apercu-reel--secours">
        <p className="cr-apercu-avis">
          Aperçu PowerPoint indisponible : le service de conversion ne
          répond pas. Rendu approché ci-dessous.
        </p>
        {secours}
      </div>
    )
  }

  const chargement = etat === 'chargement'

  return (
    <div className="cr-apercu-reel">
      {image && !chargement ? (
        <img className="cr-apercu-image" src={image}
          alt="Aperçu de la page telle qu’elle sera dans le document" />
      ) : (
        <div className="cr-apercu-vide">
          {chargement && (
            <span className="cr-apercu-spinner" role="status">
              <span className="cr-apercu-roue" aria-hidden="true" />
              Actualisation de l’aperçu…
            </span>
          )}
        </div>
      )}
    </div>
  )
}
