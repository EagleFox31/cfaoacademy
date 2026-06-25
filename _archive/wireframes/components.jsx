// Wireframe sketch components — low-fi, handwritten vibe, b&w + red accents
// Exports: WFFrame, WFNav, WFHero, WFSection, WFTabs, WFCardRow, WFCard,
//          WFFooter, WFLabel, WFNote, WFArrow, WFFilter, WFList, WFListItem,
//          WFForm, WFField, WFButton
//
// Aesthetic: handwritten, sketchy, dashed/solid hybrid borders, single red accent.

const WF_RED = '#E3001B';
const WF_INK = '#111';
const WF_MUTED = '#777';
const WF_PAPER = '#FAFAF7';
const WF_LINE = '#2A2A2A';
const WF_LINE_SOFT = '#BFBFB8';

const wfBase = {
  fontFamily: "'DM Sans', sans-serif",
  color: WF_INK,
  background: WF_PAPER,
  width: '100%',
  position: 'relative',
};

function WFFrame({ children, label, w = 1200, h }) {
  return (
    <div style={{
      width: w,
      minHeight: h || 'auto',
      background: WF_PAPER,
      border: `2px solid ${WF_LINE}`,
      borderRadius: 6,
      overflow: 'hidden',
      fontFamily: "'DM Sans', sans-serif",
      color: WF_INK,
      boxShadow: '4px 4px 0 #0001',
    }}>
      {label && (
        <div style={{
          padding: '6px 14px',
          background: WF_INK,
          color: 'white',
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 22,
          letterSpacing: 0.5,
          borderBottom: `2px solid ${WF_LINE}`,
        }}>{label}</div>
      )}
      {children}
    </div>
  );
}

function WFNav({ active }) {
  const items = ['Accueil', 'Publics', 'Formations', 'Marques', 'Sessions', 'Actualités', "L'Academy"];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 28px',
      borderBottom: `1.5px solid ${WF_LINE_SOFT}`,
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: 24, fontWeight: 700,
      }}>
        <span style={{ color: WF_RED }}>CFAO</span> Academy
      </div>
      <div style={{ display: 'flex', gap: 20, fontSize: 14 }}>
        {items.map(it => (
          <span key={it} style={{
            color: it === active ? WF_RED : WF_INK,
            fontWeight: it === active ? 700 : 400,
            borderBottom: it === active ? `2px solid ${WF_RED}` : 'none',
            paddingBottom: 2,
          }}>{it}</span>
        ))}
      </div>
      <div style={{
        padding: '6px 14px',
        border: `1.5px solid ${WF_LINE}`,
        borderRadius: 999,
        fontSize: 13,
        background: WF_INK, color: 'white',
      }}>Contact →</div>
    </div>
  );
}

function WFHero({ eyebrow, title, sub, ctas = [], chips = [], variant = 'default' }) {
  return (
    <div style={{
      padding: '40px 28px 36px',
      background: variant === 'dark' ? '#1B1D2E' : WF_PAPER,
      color: variant === 'dark' ? 'white' : WF_INK,
      borderBottom: `1.5px dashed ${WF_LINE_SOFT}`,
      position: 'relative',
    }}>
      {eyebrow && (
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: 2,
          textTransform: 'uppercase',
          color: variant === 'dark' ? '#ff6b7a' : WF_RED,
          marginBottom: 14,
        }}>{eyebrow}</div>
      )}
      <div style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: 48, lineHeight: 1, fontWeight: 700,
        maxWidth: 700,
      }}>{title}</div>
      {sub && (
        <div style={{
          fontSize: 15, color: variant === 'dark' ? '#bbb' : WF_MUTED,
          marginTop: 14, maxWidth: 560, lineHeight: 1.5,
        }}>{sub}</div>
      )}
      {(ctas.length > 0 || chips.length > 0) && (
        <div style={{ display: 'flex', gap: 12, marginTop: 22, flexWrap: 'wrap', alignItems: 'center' }}>
          {ctas.map((c, i) => (
            <div key={i} style={{
              padding: '10px 18px',
              border: `1.5px solid ${variant === 'dark' ? 'white' : WF_LINE}`,
              background: i === 0 ? WF_RED : 'transparent',
              color: i === 0 ? 'white' : (variant === 'dark' ? 'white' : WF_INK),
              borderColor: i === 0 ? WF_RED : (variant === 'dark' ? 'white' : WF_LINE),
              borderRadius: 999,
              fontSize: 14,
            }}>{c} →</div>
          ))}
          {chips.map((c, i) => (
            <div key={i} style={{
              padding: '6px 12px',
              border: `1px dashed ${variant === 'dark' ? '#888' : WF_LINE_SOFT}`,
              borderRadius: 999,
              fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace",
              color: variant === 'dark' ? '#aaa' : WF_MUTED,
            }}>{c}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function WFSection({ ix, title, voirPlus, tabs, filters, children, bg }) {
  return (
    <div style={{
      padding: '32px 28px',
      borderBottom: `1.5px dashed ${WF_LINE_SOFT}`,
      background: bg || 'transparent',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <div>
          {ix && (
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: WF_MUTED,
              letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6,
            }}>{ix}</div>
          )}
          <div style={{
            fontFamily: "'Space Grotesk', sans-serif", fontSize: 32, fontWeight: 700,
            lineHeight: 1,
          }}>{title}</div>
        </div>
        {voirPlus && (
          <div style={{
            fontSize: 13, color: WF_RED,
            borderBottom: `1.5px solid ${WF_RED}`,
            paddingBottom: 2,
          }}>{voirPlus} →</div>
        )}
      </div>
      {tabs && <WFTabs items={tabs} />}
      {filters && <WFFilter items={filters} />}
      <div style={{ marginTop: 14 }}>{children}</div>
    </div>
  );
}

function WFTabs({ items }) {
  return (
    <div style={{
      display: 'flex', gap: 8, marginTop: 10, marginBottom: 6,
      flexWrap: 'wrap',
    }}>
      {items.map((t, i) => (
        <div key={i} style={{
          padding: '5px 12px',
          border: `1.5px solid ${i === 0 ? WF_INK : WF_LINE_SOFT}`,
          background: i === 0 ? WF_INK : 'transparent',
          color: i === 0 ? 'white' : WF_INK,
          borderRadius: 999,
          fontSize: 12,
          fontFamily: "'DM Sans', sans-serif",
        }}>{t}</div>
      ))}
    </div>
  );
}

function WFFilter({ items }) {
  return (
    <div style={{
      display: 'flex', gap: 10, marginTop: 12, alignItems: 'center',
      flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 12, color: WF_MUTED, fontFamily: "'JetBrains Mono', monospace" }}>Filtres :</span>
      {items.map((f, i) => (
        <div key={i} style={{
          padding: '4px 12px',
          border: `1px dashed ${WF_LINE_SOFT}`,
          borderRadius: 6,
          fontSize: 12, color: WF_MUTED,
          background: 'white',
        }}>{f} ▾</div>
      ))}
    </div>
  );
}

function WFCardRow({ children, n = 4 }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${n}, 1fr)`,
      gap: 14,
      marginTop: 8,
      overflow: 'hidden',
      position: 'relative',
    }}>
      {children}
      <div style={{
        position: 'absolute', right: -10, top: 0, bottom: 0,
        width: 40,
        background: `linear-gradient(90deg, transparent, ${WF_PAPER})`,
        pointerEvents: 'none',
      }} />
    </div>
  );
}

function WFCard({ kicker, title, meta, h = 140, dark }) {
  return (
    <div style={{
      border: `1.5px solid ${WF_LINE_SOFT}`,
      borderRadius: 6,
      background: 'white',
      overflow: 'hidden',
    }}>
      <div style={{
        height: h, background: dark ? '#222' : '#EAE9E2',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: dark ? '#777' : '#999',
        fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
        backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 8px, ${dark ? '#2a2a2a' : '#DEDDD6'} 8px, ${dark ? '#2a2a2a' : '#DEDDD6'} 9px)`,
      }}>IMAGE</div>
      <div style={{ padding: '10px 12px 12px' }}>
        {kicker && (
          <div style={{
            fontSize: 10, color: WF_RED, fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: 1, textTransform: 'uppercase',
          }}>{kicker}</div>
        )}
        <div style={{
          fontSize: 14, fontWeight: 600, marginTop: 4, lineHeight: 1.25,
          fontFamily: "'DM Sans', sans-serif",
        }}>{title}</div>
        {meta && (
          <div style={{
            fontSize: 11, color: WF_MUTED, marginTop: 6,
            fontFamily: "'JetBrains Mono', monospace",
          }}>{meta}</div>
        )}
      </div>
    </div>
  );
}

function WFList({ children }) {
  return (
    <div style={{
      border: `1px solid ${WF_LINE_SOFT}`,
      borderRadius: 6,
      background: 'white',
      marginTop: 8,
    }}>{children}</div>
  );
}

function WFListItem({ date, code, title, tag, lieu, meta }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '90px 1fr 130px 110px 32px',
      gap: 16,
      padding: '12px 14px',
      borderBottom: `1px dashed ${WF_LINE_SOFT}`,
      alignItems: 'center',
    }}>
      <div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{date}</div>
        {meta && <div style={{ fontSize: 9, color: WF_RED, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1 }}>{meta}</div>}
      </div>
      <div>
        <div style={{ fontSize: 10, color: WF_MUTED, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1, textTransform: 'uppercase' }}>{code}</div>
        <div style={{ fontSize: 13, marginTop: 2 }}>{title}</div>
      </div>
      <div style={{ fontSize: 11, padding: '3px 8px', border: `1px solid ${WF_LINE_SOFT}`, borderRadius: 999, justifySelf: 'start', background: '#F4F2EB' }}>{tag}</div>
      <div style={{ fontSize: 12, color: WF_INK }}>{lieu}</div>
      <div style={{
        width: 26, height: 26, border: `1.5px solid ${WF_LINE_SOFT}`, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
      }}>↗</div>
    </div>
  );
}

function WFNote({ children, top, left, right, bottom, rotate = -2 }) {
  return (
    <div style={{
      position: 'absolute', top, left, right, bottom,
      transform: `rotate(${rotate}deg)`,
      background: '#FFF7C2',
      border: `1px solid #E8D89B`,
      padding: '8px 12px',
      fontFamily: "'Space Grotesk', sans-serif",
      fontSize: 16,
      color: WF_INK,
      boxShadow: '2px 2px 0 #0002',
      maxWidth: 220,
      lineHeight: 1.2,
      zIndex: 10,
    }}>{children}</div>
  );
}

function WFArrow({ children, color = WF_RED }) {
  return (
    <span style={{
      fontFamily: "'Space Grotesk', sans-serif",
      color, fontSize: 18,
    }}>↳ {children}</span>
  );
}

function WFFooter() {
  return (
    <div style={{
      padding: '20px 28px',
      background: '#1B1D2E',
      color: '#bbb',
      display: 'flex', justifyContent: 'space-between',
      fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
    }}>
      <div>Footer · Métiers · Formations · Marques · Ressources</div>
      <div>Catalogue PDF · Contact · Espace apprenant · Mentions</div>
    </div>
  );
}

function WFForm({ fields = [], cta }) {
  return (
    <div style={{
      border: `1.5px solid ${WF_LINE_SOFT}`,
      borderRadius: 6, background: 'white',
      padding: 16,
    }}>
      {fields.map((f, i) => (
        <div key={i} style={{
          padding: '10px 12px',
          border: `1px dashed ${WF_LINE_SOFT}`,
          borderRadius: 4,
          fontSize: 12, color: WF_MUTED,
          fontFamily: "'DM Sans', sans-serif",
          marginBottom: 8,
        }}>{f}</div>
      ))}
      {cta && (
        <div style={{
          padding: '10px 18px',
          background: WF_RED, color: 'white',
          borderRadius: 999, fontSize: 13,
          width: 'fit-content', marginTop: 6,
        }}>{cta} →</div>
      )}
    </div>
  );
}

function WFLabel({ children }) {
  return (
    <div style={{
      display: 'inline-block',
      padding: '3px 8px',
      background: WF_RED, color: 'white',
      fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
      letterSpacing: 1, textTransform: 'uppercase',
      borderRadius: 3,
    }}>{children}</div>
  );
}

function WFPerson({ name, role, lieu, silhouette, photo }) {
  const initials = name ? name.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase() : '?';
  return (
    <div style={{
      border: `1.5px solid ${WF_LINE_SOFT}`,
      borderLeft: `4px solid ${WF_RED}`,
      borderRadius: 6, background: 'white',
      padding: '12px 12px 12px 14px',
      display: 'flex', gap: 10, alignItems: 'flex-start',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        background: silhouette ? '#3A3A3A' : '#EAE9E2',
        border: `1.5px solid ${WF_LINE_SOFT}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600,
        fontSize: 13, color: silhouette ? 'white' : WF_INK,
        overflow: 'hidden',
        backgroundImage: photo ? `url("${photo}")` : 'none',
        backgroundSize: 'cover', backgroundPosition: 'center top',
      }}>{photo ? '' : (silhouette ? '○' : initials)}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>{name || '—'}</div>
        <div style={{ fontSize: 11, color: WF_MUTED, marginTop: 2, lineHeight: 1.3 }}>{role}</div>
        {lieu && (
          <div style={{
            fontSize: 10, color: WF_RED, marginTop: 4,
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: 1, textTransform: 'uppercase',
          }}>{lieu}</div>
        )}
      </div>
    </div>
  );
}

function WFNetwork({ count, label, scope, color = WF_RED }) {
  return (
    <div style={{
      border: `1.5px solid ${WF_LINE_SOFT}`,
      borderRadius: 6, background: 'white', padding: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <div style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 44, fontWeight: 700, color: WF_INK, lineHeight: 1,
        }}>{count}</div>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
          color, letterSpacing: 1.5, textTransform: 'uppercase',
        }}>{label}</div>
      </div>
      <div style={{ fontSize: 12, color: WF_MUTED, marginTop: 6, lineHeight: 1.4 }}>{scope}</div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)',
        gap: 4, marginTop: 12,
      }}>
        {Array.from({ length: Math.min(count, 30) }).map((_, i) => (
          <div key={i} style={{
            aspectRatio: '1', borderRadius: '50%',
            background: '#3A3A3A',
            opacity: 0.55 + (i % 3) * 0.15,
          }} />
        ))}
        {count > 30 && (
          <div style={{
            gridColumn: 'span 2',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10, color: WF_MUTED, display: 'flex', alignItems: 'center',
          }}>+{count - 30}</div>
        )}
      </div>
    </div>
  );
}

function WFCountries({ items, potentiels }) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
        {items.map((c, i) => (
          <div key={i} style={{
            padding: '8px 10px',
            border: `1px solid ${WF_LINE_SOFT}`,
            borderRadius: 4, background: 'white',
            fontSize: 12, fontWeight: 500,
          }}>{c}</div>
        ))}
      </div>
      {potentiels && (
        <div style={{ marginTop: 14 }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
            color: WF_MUTED, letterSpacing: 1.5, textTransform: 'uppercase',
            marginBottom: 6,
          }}>En développement</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {potentiels.map((c, i) => (
              <div key={i} style={{
                padding: '6px 12px',
                border: `1px dashed ${WF_LINE_SOFT}`,
                borderRadius: 4, color: WF_MUTED,
                fontSize: 11, background: '#FAFAF7',
              }}>{c}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  WFFrame, WFNav, WFHero, WFSection, WFTabs, WFFilter,
  WFCardRow, WFCard, WFList, WFListItem, WFFooter,
  WFNote, WFArrow, WFForm, WFLabel,
  WFPerson, WFNetwork, WFCountries,
  WF_RED, WF_INK, WF_MUTED, WF_PAPER, WF_LINE, WF_LINE_SOFT,
});
