import { STATS } from '../data/index.js'

const ITEMS = [
  { n: STATS.sessions,    lbl: 'sessions distinctes au catalogue 2026' },
  { n: STATS.bu,          lbl: 'Business Units couvertes' },
  { n: STATS.marques,     lbl: 'marques constructeurs' },
  { n: STATS.paysActifs,  lbl: "pays d'intervention en Afrique" },
  { n: STATS.experts,     lbl: 'experts formateurs · 5 pôles' },
]

export default function KpiBand() {
  return (
    <div className="kpi-band">
      <div className="container">
        <div className="kpis">
          {ITEMS.map((k, i) => (
            <div className="kpi reveal" key={i}>
              <div className="micro ix">{String(i + 1).padStart(3, '0')}</div>
              <div className="num">{k.n}</div>
              <div className="lbl">{k.lbl}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
