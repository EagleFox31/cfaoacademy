/* CFAO Academy — bibliothèque de composants réutilisables
   Partagée entre toutes les pages. Émet les classes de styles.css + academy.css. */

const { useState, useEffect, useRef } = React;

// ════════════════ EFFETS DE SITE (parallax, reveal, glow…) ════════════════
function useSiteEffects() {
  useEffect(() => {
    // hero h1 reveal
    const raf = requestAnimationFrame(() => {
      document.querySelector('.hero-h1')?.classList.add('shown');
    });

    // reveal on scroll (éléments .reveal / .stagger non gérés par <Reveal>)
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    document.querySelectorAll('.reveal, .stagger').forEach(el => io.observe(el));

    // parallax (scroll-linked)
    const parallaxEls = [...document.querySelectorAll('.parallax')];
    const parallaxXEls = [...document.querySelectorAll('.parallax-x')];
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const vh = window.innerHeight;
        parallaxEls.forEach(el => {
          const speed = parseFloat(el.dataset.speed || '0.1');
          const rect = el.getBoundingClientRect();
          const center = rect.top + rect.height / 2;
          const offset = (center - vh / 2) * speed;
          el.style.transform = `translate3d(0, ${(-offset).toFixed(2)}px, 0)`;
        });
        parallaxXEls.forEach(el => {
          const speed = parseFloat(el.dataset.speed || '0.3');
          const rect = el.getBoundingClientRect();
          const center = rect.top + rect.height / 2;
          const offset = (center - vh / 2) * speed;
          el.style.transform = `translate3d(${offset.toFixed(2)}px, 0, 0)`;
        });
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // scroll progress bar
    const progressBar = document.createElement('div');
    progressBar.className = 'scroll-progress';
    document.body.appendChild(progressBar);
    function updateProgress() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const pct = max > 0 ? Math.max(0, Math.min(100, (window.scrollY / max) * 100)) : 0;
      progressBar.style.width = pct + '%';
    }
    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();

    // cursor glow
    const glow = document.getElementById('cursor-glow');
    let glowRaf;
    if (glow && matchMedia('(pointer:fine)').matches) {
      let x = 0, y = 0, tx = 0, ty = 0;
      const onMove = e => { tx = e.clientX; ty = e.clientY; glow.style.opacity = '1'; };
      window.addEventListener('mousemove', onMove);
      const loop = () => {
        x += (tx - x) * 0.12; y += (ty - y) * 0.12;
        glow.style.left = x + 'px'; glow.style.top = y + 'px';
        glowRaf = requestAnimationFrame(loop);
      };
      loop();
    }

    // magnetic buttons
    const magnets = [...document.querySelectorAll('.btn-primary, .nav-cta')];
    const magnetHandlers = magnets.map(btn => {
      const move = (e) => {
        const r = btn.getBoundingClientRect();
        const mx = (e.clientX - r.left - r.width / 2) * 0.18;
        const my = (e.clientY - r.top - r.height / 2) * 0.25;
        btn.style.transform = `translate(${mx}px, ${my}px)`;
      };
      const leave = () => { btn.style.transform = ''; };
      btn.addEventListener('mousemove', move);
      btn.addEventListener('mouseleave', leave);
      return { btn, move, leave };
    });

    // counters
    const numObs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const el = e.target;
        if (el.dataset.done) return;
        el.dataset.done = '1';
        const original = el.innerHTML;
        const text = el.textContent.replace(/\u00A0/g, ' ');
        const m = text.match(/(\d[\d\s]*)/);
        if (!m) return;
        const target = parseInt(m[1].replace(/\s/g, ''), 10);
        if (isNaN(target) || target < 5) return;
        const dur = 1400, start = performance.now();
        const ease = t => 1 - Math.pow(1 - t, 3);
        const fmt = n => n >= 1000 ? n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0') : String(n);
        function frame(now) {
          const t = Math.min(1, (now - start) / dur);
          const v = Math.round(target * ease(t));
          el.innerHTML = original.replace(m[1].replace(/\s/g, '\u00A0'), fmt(v)).replace(m[1], fmt(v));
          if (t < 1) requestAnimationFrame(frame); else el.innerHTML = original;
        }
        requestAnimationFrame(frame);
        numObs.unobserve(el);
      });
    }, { threshold: 0.5 });
    document.querySelectorAll('.kpi .num, .hero-floating-card .num').forEach(el => numObs.observe(el));

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(glowRaf);
      io.disconnect();
      numObs.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', updateProgress);
      progressBar.remove();
      magnetHandlers.forEach(({ btn, move, leave }) => {
        btn.removeEventListener('mousemove', move);
        btn.removeEventListener('mouseleave', leave);
      });
    };
  }, []);
}

// ════════════════ REVEAL wrapper ════════════════
function Reveal({ as = 'div', className = '', stagger = false, style, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { el.classList.add('in'); io.unobserve(el); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const Tag = as;
  return (
    <Tag ref={ref} className={`${stagger ? 'stagger' : 'reveal'} ${className}`} style={style}>
      {children}
    </Tag>
  );
}

// ════════════════ NAV ════════════════
function Nav({ active }) {
  const { NAV } = window.ACADEMY_DATA;
  return (
    <nav className="nav">
      <div className="container nav-inner">
        <a className="brand" href="Accueil.html" style={{ textDecoration: 'none' }}>
          <img src="assets/logo-cfao-mobility.jpg" alt="cfao mobility" className="brand-mark" />
          <div className="brand-label">academy<span>.</span></div>
        </a>
        <ul className="nav-links">
          {NAV.filter(n => n.key !== 'accueil').map(n => (
            <li key={n.key}><a href={n.href} className={active === n.key ? 'active' : ''}>{n.label}</a></li>
          ))}
        </ul>
        <a href="Sessions.html" className="nav-cta">S'inscrire à une session</a>
      </div>
    </nav>
  );
}

// ════════════════ HERO (Accueil) ════════════════
function HomeHero() {
  const { STATS } = window.ACADEMY_DATA;
  return (
    <header className="hero">
      <div className="hero-deco">
        <div className="grid-lines parallax" data-speed="-0.08"></div>
        <div className="blob blob-1 parallax" data-speed="-0.18"></div>
        <div className="blob blob-2 parallax" data-speed="0.12"></div>
        <div className="bg-word right parallax" data-speed="-0.45" aria-hidden="true" style={{ bottom: '-80px', right: '-100px' }}>2026</div>
      </div>
      <div className="container hero-grid">
        <div>
          <div className="hero-top mono">
            <span className="dot"></span>
            <span>CFAO ACADEMY · DOUALA · 2026</span>
            <span>—</span>
            <span>Excellence technique mobilité</span>
          </div>
          <h1 className="hero-h1">
            Le réseau forme<br />
            ses talents <span className="accent">en&nbsp;Afrique</span>.
          </h1>
          <p className="hero-sub">
            {STATS.marques} marques, {STATS.paysActifs} pays, {STATS.experts} experts,
            {' '}{STATS.sessions} sessions au catalogue 2026. Formation andragogique, sur le terrain.
          </p>
          <div className="hero-badges">
            <span className="hero-badge"><span className="pulse"></span> Inscriptions 2026 ouvertes</span>
            <span className="hero-badge">★ {STATS.marques} marques constructeurs</span>
            <span className="hero-badge">⚡ {STATS.experts} experts · {STATS.paysActifs} pays</span>
          </div>
          <div className="hero-actions">
            <a href="Sessions.html" className="btn btn-primary">Calendrier 2026 <span className="arrow">→</span></a>
            <a href="Formations.html" className="btn btn-ghost">Télécharger le catalogue</a>
          </div>
        </div>

        <div className="hero-side">
          <div className="hero-photo">
            <div className="photo-inner parallax" data-speed="0.15">
              <img src="assets/cfao-academy-douala.jpg" alt="CFAO Academy Douala Cameroun" />
            </div>
            <div className="hero-photo-overlay"></div>
            <div className="hero-photo-caption">
              <div>
                <div className="micro">Site principal</div>
                <div className="place">Douala — Cameroun</div>
              </div>
              <div className="micro" style={{ opacity: .85 }}>04°03'N · 9°43'E</div>
            </div>
          </div>
          <div className="hero-floating-card parallax" data-speed="0.07">
            <div className="micro" style={{ color: 'var(--muted)' }}>Sessions au catalogue 2026</div>
            <div className="num">{STATS.sessions}<sup>+</sup></div>
            <div className="lbl">Réparties sur {STATS.bu} Business Units · présentiel &amp; distanciel</div>
          </div>
          <div className="hero-chips">
            <span className="hero-chip parallax" data-speed="-0.18" style={{ top: '18%', right: '-10%' }}>
              <img src="assets/logos/toyota.png" alt="Toyota" />
            </span>
            <span className="hero-chip parallax" data-speed="-0.10" style={{ top: '54%', left: '-12%' }}>
              <img src="assets/logos/hino.png" alt="Hino" style={{ filter: 'none' }} />
            </span>
            <span className="hero-chip parallax" data-speed="-0.22" style={{ bottom: '-4%', right: '14%' }}>
              <span className="dot"></span> Session live
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

// ════════════════ MARQUEE de logos ════════════════
function LogoMarquee() {
  const { BRANDS } = window.ACADEMY_DATA;
  const logos = BRANDS.filter(b => b.logo);
  const row = logos.map((b, i) => (
    <div className="logo-pill" key={i}><img src={b.logo} alt={b.name} /></div>
  ));
  return (
    <div className="marquee-wrap">
      <div className="marquee">{row}{row}</div>
    </div>
  );
}

// ════════════════ KPI BAND ════════════════
function KpiBand() {
  const { STATS } = window.ACADEMY_DATA;
  const items = [
    { n: STATS.sessions, lbl: 'sessions distinctes au catalogue 2026' },
    { n: STATS.bu, lbl: 'Business Units couvertes' },
    { n: STATS.marques, lbl: 'marques constructeurs' },
    { n: STATS.paysActifs, lbl: "pays d'intervention en Afrique" },
    { n: STATS.experts, lbl: 'experts formateurs · 5 pôles' },
  ];
  return (
    <div className="container">
      <div className="kpis">
        {items.map((k, i) => (
          <div className="kpi reveal" key={i}>
            <div className="micro ix">{String(i + 1).padStart(3, '0')}</div>
            <div className="num">{k.n}</div>
            <div className="lbl">{k.lbl}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════ PREVIEW SECTION (aperçu de page) ════════════════
function PreviewSection({ ix, title, voir, tabs, filters, bgWord, bgWordSide = 'right', children }) {
  const [active, setActive] = useState(tabs && tabs.length ? tabs[0].id : null);
  return (
    <section className={`tight ${bgWord ? 'has-deco' : ''}`}>
      {bgWord && (
        <span className={`bg-word ${bgWordSide} parallax`} data-speed="-0.38" aria-hidden="true"
          style={bgWordSide === 'left' ? { top: '6%' } : { top: '8%' }}>{bgWord}</span>
      )}
      <div className="container">
        <div className="pv-head">
          <div className="pv-head-l">
            <div className="pv-ix">{ix}</div>
            <h2>{title}</h2>
          </div>
          {voir && <a className="pv-voir" href={voir.href}>{voir.label} <span className="arrow">→</span></a>}
        </div>
        {tabs && tabs.length > 0 && (
          <div className="pv-tabs">
            {tabs.map(t => (
              <button key={t.id} className={`pv-tab ${active === t.id ? 'active' : ''}`} onClick={() => setActive(t.id)}>
                {t.label}{typeof t.count === 'number' && <span className="tab-count">{t.count}</span>}
              </button>
            ))}
          </div>
        )}
        {filters && filters.length > 0 && (
          <div className="pv-filters">
            <span className="lbl">Filtrer</span>
            {filters.map((f, i) => <span className="pv-filter" key={i}>{f}</span>)}
          </div>
        )}
        <Reveal>
          {typeof children === 'function' ? children(active) : children}
        </Reveal>
      </div>
    </section>
  );
}

// ════════════════ CARTES ════════════════
function PvCard({ kicker, title, meta, variant, corner, href }) {
  const Tag = href ? 'a' : 'div';
  const cls = `pv-card${variant ? ` pv-card--${variant}` : ''}`;
  return (
    <Tag className={cls} href={href}>
      {kicker && <div className="kicker">{kicker}</div>}
      <h3>{title}</h3>
      {meta && <div className="meta">{meta}</div>}
      {corner && <span className="corner">↗</span>}
    </Tag>
  );
}

function BrandCard({ b }) {
  return (
    <a className="pv-card pv-card--brand" href="Marques.html">
      <div className="count">{String(b.n).padStart(2, '0')} sessions</div>
      <div className="pv-brand-logo">
        {b.logo
          ? <img src={b.logo} alt={b.name} />
          : <span className="pv-brand-wordmark">{b.name}</span>}
      </div>
      <div>
        <div className="cat">{b.cat}</div>
        <div className="name">{b.name}</div>
      </div>
    </a>
  );
}

// ════════════════ SESSION ROW ════════════════
function SessionRow({ s }) {
  const { fmtDay } = window.ACADEMY_DATA;
  const { day, mo, year } = fmtDay(s.date);
  const isDist = s.lieu === 'Distanciel';
  return (
    <a href="Sessions.html" className="session" style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="date">
        <div className="day">{day}</div>
        <div className="mo">{mo} · {year}</div>
      </div>
      <div className="title">
        <small>{s.code} · {s.marque} · <span className="lvl">{s.niveau}</span></small>
        {s.nom}
        <div className="meta">Formateur <strong>{s.formateur}</strong> · {isDist ? 'places sur demande' : '12 places'}</div>
      </div>
      <span className={`tag ${s.tagClass}`}>{s.bu}</span>
      <div className="place">
        {isDist ? <em>(en ligne)</em> : s.lieu}
        <span className="dur">· {s.jours} {s.jours > 1 ? 'jours' : 'jour'}</span>
      </div>
      <span className="open" aria-label="Voir la session">↗</span>
    </a>
  );
}

// ════════════════ CTA BANNER ════════════════
function CtaBanner() {
  return (
    <section className="tight" style={{ paddingBottom: '140px' }}>
      <div className="container">
        <Reveal className="cta-banner">
          <div className="blob-m parallax" data-speed="-0.15"></div>
          <div>
            <div className="eyebrow" style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '18px' }}>
              Programme 2026 · Inscriptions ouvertes
            </div>
            <h2>Prêt·e à <em>monter</em><br />en compétence ?</h2>
          </div>
          <div className="right">
            <p>
              Demandez le catalogue complet 2026, échangez avec notre équipe pédagogique,
              ou inscrivez directement un collaborateur à la prochaine session.
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <a href="Sessions.html" className="btn btn-primary">S'inscrire à une session <span className="arrow">→</span></a>
              <a href="Contact.html" className="btn btn-ghost" style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'white' }}>Nous contacter</a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ════════════════ FOOTER ════════════════
function Footer() {
  const { STATS } = window.ACADEMY_DATA;
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-top">
          <div>
            <img src="assets/logo-cfao-mobility.jpg" alt="cfao mobility" className="brand-mark" />
            <p className="lead">
              CFAO Academy — le centre de formation technique de CFAO Mobility.
              Excellence après-vente pour la mobilité en Afrique.
            </p>
          </div>
          <div>
            <h5>Explorer</h5>
            <ul>
              <li><a href="Publics.html">Publics</a></li>
              <li><a href="Formations.html">Formations</a></li>
              <li><a href="Marques.html">Marques</a></li>
              <li><a href="Sessions.html">Sessions</a></li>
            </ul>
          </div>
          <div>
            <h5>Ressources</h5>
            <ul>
              <li><a href="Actualites.html">Actualités</a></li>
              <li><a href="Academy.html">L'Academy</a></li>
              <li><a href="Sessions.html">Calendrier 2026</a></li>
              <li><a href="Formations.html">Catalogue PDF</a></li>
            </ul>
          </div>
          <div>
            <h5>Contact</h5>
            <ul>
              <li><a href="Contact.html">academy@cfaomobility.com</a></li>
              <li><a href="Academy.html">CFAO Academy — Douala, Cameroun</a></li>
              <li><a href="Academy.html">Présent dans {STATS.paysActifs} pays d'Afrique</a></li>
              <li><a href="Espace.html">Espace apprenant ↗</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <div>© 2026 CFAO Mobility — CFAO Academy. Tous droits réservés.</div>
          <div>Conçue à Douala 🇨🇲</div>
        </div>
      </div>
    </footer>
  );
}

// ════════════════ EXPORTS ════════════════
Object.assign(window, {
  useSiteEffects, Reveal, Nav, HomeHero, LogoMarquee, KpiBand,
  PreviewSection, PvCard, BrandCard, SessionRow, CtaBanner, Footer,
});
