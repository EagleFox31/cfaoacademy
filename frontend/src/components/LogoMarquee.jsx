import { BRANDS } from '../data/index.js'
import useLocale from '../hooks/useLocale.js'

export default function LogoMarquee() {
  const { t } = useLocale('marquee')
  const logos = BRANDS.filter((b) => b.logo)
  const row = logos.map((b, i) => (
    <div className="logo-pill" key={i}>
      <img src={b.logo} alt={b.name} />
    </div>
  ))

  return (
    <div className="marquee-wrap logo-marquee-wrap">
      <div className="container">
        <div className="pv-head pv-head--compact-line marquee-head">
          <div className="pv-head-l">
            <h2>
              {t.brandsTitleBefore}
              <em>{t.brandsTitleEm}</em>
              {t.brandsTitleAfter}
            </h2>
          </div>
        </div>
      </div>
      <div className="marquee">{row}{row}</div>
    </div>
  )
}
