import PvCard from './PvCard.jsx'
import { formatPublicCardKicker } from '../utils/publicFormationCount.js'
import {
  getPublicCardImage,
  getPublicCardImagePosition,
  getPublicCardLink,
  isPublicCardLocked,
} from '../utils/publicFiches.js'
import useLocale from '../hooks/useLocale.js'
import { formatPublicKicker, localizedPublicFields } from '../utils/localizeCard.js'

export default function PublicCard({ public: pub }) {
  const { locale, t: cardsT } = useLocale('cards')
  const locked = isPublicCardLocked(pub.name)
  const link = getPublicCardLink(pub.name)
  const img = getPublicCardImage(pub.name, pub.img)
  const imgPosition = getPublicCardImagePosition(pub.name)
  const copy = localizedPublicFields(pub, locale)
  const kicker = locale === 'fr'
    ? formatPublicCardKicker(pub.niv, pub.name)
    : formatPublicKicker(copy.niv, pub.name, locale)

  return (
    <PvCard
      corner={!locked}
      className={locked ? 'pv-card--locked' : ''}
      to={!locked && link ? link : undefined}
      accentColor={pub.color}
      kicker={kicker}
      title={copy.name}
      meta={copy.meta}
      img={img}
      imgPosition={imgPosition}
      hoverHint={!locked && link ? cardsT.discoverPath : false}
    />
  )
}
