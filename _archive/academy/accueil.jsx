/* CFAO Academy — Accueil : composition des 7 blocs du wireframe validé */

const { useState: useStateAcc } = React;

function Accueil() {
  useSiteEffects();
  const D = window.ACADEMY_DATA;
  const { fmtNewsDate } = D;

  // ── compteurs d'onglets ──
  const newsTabs = D.NEWS_CATS.map(c => ({
    id: c.id, label: c.label,
    count: c.id === 'all' ? D.NEWS.length : D.NEWS.filter(n => n.cat === c.id).length,
  }));
  const publicFamilles = ['Tous', 'Atelier', 'Vente', 'Process & SAV', 'Clients'];
  const publicTabs = publicFamilles.map(f => ({
    id: f, label: f,
    count: f === 'Tous' ? D.PUBLICS.length : D.PUBLICS.filter(p => p.famille === f).length,
  }));
  const marqueTabs = D.BRAND_CATS.map(c => ({
    id: c.id, label: c.label,
    count: c.id === 'all' ? D.BRANDS.length : D.BRANDS.filter(b => b.group === c.id).length,
  }));
  const upcoming = D.SESSIONS;
  const sessionTabs = [{ id: 'all', label: 'Tous', count: upcoming.length }]
    .concat(D.BU.map(b => ({ id: b.id, label: b.short, count: upcoming.filter(s => s.bu === b.id).length })));

  return (
    <React.Fragment>
      <div className="cursor-glow" id="cursor-glow"></div>
      <Nav active="accueil" />
      <HomeHero />
      <LogoMarquee />
      <KpiBand />

      {/* ── 02 · ACTUALITÉS ── */}
      <PreviewSection
        ix="À la une"
        title={<>Les <em>nouvelles</em> de l'Academy.</>}
        voir={{ label: "Toutes les actualités", href: "Actualites.html" }}
        tabs={newsTabs}
        filters={["Marque", "Pays"]}
        bgWord="news" bgWordSide="left"
      >
        {(active) => {
          const items = (active === 'all' ? D.NEWS : D.NEWS.filter(n => n.cat === active))
            .slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
          return (
            <div className="pv-grid cols-4">
              {items.map((n, i) => (
                <PvCard key={n.h + i} href="Actualites.html" corner
                  kicker={`${n.cat} · ${fmtNewsDate(n.date)}`}
                  title={n.h}
                  meta={n.p || (n.readtime ? `${n.readtime} de lecture` : "Lire l'article →")}
                />
              ))}
            </div>
          );
        }}
      </PreviewSection>

      {/* ── 03 · PUBLICS ── */}
      <PreviewSection
        ix="Par public"
        title={<>7 publics, <em>7 parcours</em>.</>}
        voir={{ label: "Explorer les publics", href: "Publics.html" }}
        tabs={publicTabs}
      >
        {(active) => {
          const items = active === 'Tous' ? D.PUBLICS : D.PUBLICS.filter(p => p.famille === active);
          return (
            <div className="pv-grid cols-4">
              {items.map((p, i) => (
                <PvCard key={p.name + i} href="Publics.html" corner
                  kicker={p.kicker} title={p.name} meta={p.meta} />
              ))}
            </div>
          );
        }}
      </PreviewSection>

      {/* ── 04 · FORMATIONS ── */}
      <PreviewSection
        ix="Par Business Unit"
        title={<>253 sessions, <em>5 Business Units</em>.</>}
        voir={{ label: "Voir le catalogue", href: "Formations.html" }}
        filters={["Marque", "Public", "Niveau", "Lieu"]}
        bgWord="catalogue" bgWordSide="right"
      >
        <div className="pv-grid cols-5">
          {D.BU.map((b, i) => (
            <PvCard key={b.id} href="Formations.html" corner
              kicker={`${b.n} sessions`} title={b.id} meta={b.meta} />
          ))}
        </div>
      </PreviewSection>

      {/* ── 05 · MARQUES ── */}
      <PreviewSection
        ix={`${D.STATS.marques} constructeurs`}
        title={<>Le réseau <em>constructeur</em> complet.</>}
        voir={{ label: "Toutes les marques", href: "Marques.html" }}
        tabs={marqueTabs}
      >
        {(active) => {
          const items = (active === 'all' ? D.BRANDS : D.BRANDS.filter(b => b.group === active)).slice(0, 6);
          return (
            <div className="pv-grid cols-3">
              {items.map((b, i) => <BrandCard key={b.name + i} b={b} />)}
            </div>
          );
        }}
      </PreviewSection>

      {/* ── 06 · SESSIONS À VENIR ── */}
      <PreviewSection
        ix="Calendrier 2026"
        title={<>Sessions à venir & <em>inscriptions</em>.</>}
        voir={{ label: "Voir le calendrier complet", href: "Sessions.html" }}
        tabs={sessionTabs}
        bgWord="2026" bgWordSide="right"
      >
        {(active) => {
          const list = (active === 'all' ? upcoming : upcoming.filter(s => s.bu === active)).slice(0, 6);
          const total = active === 'all'
            ? D.STATS.sessions
            : (D.BU.find(b => b.id === active)?.n || list.length);
          return (
            <div>
              <div className="sessions">
                {list.length
                  ? list.map((s, i) => <SessionRow key={s.code + s.date + i} s={s} />)
                  : <div style={{ padding: '40px 8px', color: 'var(--muted)' }}>Aucune session à venir pour ce filtre.</div>}
              </div>
              <div className="pv-sessions-foot">
                <div className="count"><strong>{list.length}</strong> prochaines sessions affichées · <strong>{total}</strong> au programme 2026</div>
                <a href="Sessions.html" className="btn btn-dark">Voir le calendrier complet <span className="arrow">→</span></a>
              </div>
            </div>
          );
        }}
      </PreviewSection>

      {/* ── 07 · L'ACADEMY ── */}
      <PreviewSection
        ix="L'Academy"
        title={<>L'<em>excellence technique</em> de la mobilité africaine.</>}
        voir={{ label: "Découvrir l'Academy", href: "Academy.html" }}
        bgWord="academy" bgWordSide="left"
      >
        <div className="pv-grid cols-4">
          {D.ACADEMY_PREVIEW.map((a, i) => (
            <PvCard key={i} variant="stat" href="Academy.html" corner
              kicker={a.kicker} title={a.title} meta={a.meta} />
          ))}
        </div>
      </PreviewSection>

      <CtaBanner />
      <Footer />
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Accueil />);
