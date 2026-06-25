/* CFAO Academy — Tweaks Panel */
const { useState, useEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "primary": "#E3001B",
  "navy": "#1A1F3C",
  "heroVariant": "editorial",
  "showFloatingCard": true,
  "headline": "Former la nouvelle génération de l'après-vente mobilité en Afrique."
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  useEffect(() => {
    document.documentElement.style.setProperty('--red', t.primary);
    document.documentElement.style.setProperty('--navy', t.navy);
    // derived
    const r = t.primary;
    document.documentElement.style.setProperty('--red-deep', shadeColor(r, -20));
  }, [t.primary, t.navy]);

  useEffect(() => {
    const card = document.querySelector('.hero-floating-card');
    if (card) card.style.display = t.showFloatingCard ? '' : 'none';
  }, [t.showFloatingCard]);

  useEffect(() => {
    const h1 = document.querySelector('.hero-h1');
    if (!h1) return;
    // only swap if custom
    if (t.headline && t.headline !== TWEAK_DEFAULTS.headline) {
      // simple swap: replace plain text content
      h1.textContent = t.headline;
    }
  }, [t.headline]);

  useEffect(() => {
    const heroH1 = document.querySelector('.hero-h1');
    if (!heroH1) return;
    document.body.dataset.heroVariant = t.heroVariant;
  }, [t.heroVariant]);

  return (
    <TweaksPanel title="Tweaks">
      <TweakSection title="Identité visuelle">
        <TweakColor
          label="Couleur primaire"
          value={t.primary}
          onChange={(v) => setTweak('primary', v)}
          options={['#E3001B', '#1A1F3C', '#0E6BC0', '#0F7B45', '#C75D00']}
        />
        <TweakColor
          label="Couleur secondaire"
          value={t.navy}
          onChange={(v) => setTweak('navy', v)}
          options={['#1A1F3C', '#0B0E1F', '#2A3157', '#1B2B4E']}
        />
      </TweakSection>

      <TweakSection title="Hero">
        <TweakToggle
          label="Carte flottante 253 sessions"
          value={t.showFloatingCard}
          onChange={(v) => setTweak('showFloatingCard', v)}
        />
        <TweakText
          label="Titre principal"
          value={t.headline}
          onChange={(v) => setTweak('headline', v)}
        />
      </TweakSection>
    </TweaksPanel>
  );
}

function shadeColor(hex, percent) {
  const n = parseInt(hex.replace('#',''), 16);
  let r = (n >> 16) & 0xff;
  let g = (n >> 8) & 0xff;
  let b = n & 0xff;
  const f = (1 + percent/100);
  r = Math.max(0, Math.min(255, Math.round(r * f)));
  g = Math.max(0, Math.min(255, Math.round(g * f)));
  b = Math.max(0, Math.min(255, Math.round(b * f)));
  return '#' + [r,g,b].map(x => x.toString(16).padStart(2,'0')).join('');
}

const root = document.createElement('div');
document.body.appendChild(root);
ReactDOM.createRoot(root).render(<App />);
