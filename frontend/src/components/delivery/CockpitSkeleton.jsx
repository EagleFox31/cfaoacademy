/** Skeleton shimmer du cockpit — reproduit le layout de la vue d'ensemble
 *  (cartes KPI + lignes projets) le temps du montage. */
export default function CockpitSkeleton() {
  return (
    <div className="dlv-skel" aria-hidden="true">
      <div className="dlv-kpis">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="dlv-kpi">
            <div className="skel skel--text" style={{ width: '55%' }} />
            <div className="skel" style={{ height: 30, width: '42%', marginTop: 12, borderRadius: 8 }} />
            <div className="skel skel--text" style={{ width: '70%', marginTop: 11 }} />
            <div className="skel skel--bar" style={{ marginTop: 13 }} />
          </div>
        ))}
      </div>

      <div className="skel skel--title" style={{ margin: '28px 0 14px' }} />

      <div className="dlv-rows">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="dlv-proj">
            <div className="skel" style={{ width: 36, height: 36, borderRadius: 9, flex: 'none' }} />
            <div className="dlv-proj-main">
              <div style={{ display: 'flex', gap: 8, marginBottom: 11, alignItems: 'center' }}>
                <div className="skel skel--text" style={{ width: 130 }} />
                <div className="skel skel--pill skel--dim" />
                <div className="skel skel--pill skel--dim" style={{ width: 96 }} />
              </div>
              <div className="skel skel--bar" />
            </div>
            <div className="skel" style={{ width: 48, height: 24, borderRadius: 6, flex: 'none' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
