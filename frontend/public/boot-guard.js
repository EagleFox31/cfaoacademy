/*
 * Garde-fou de démarrage : si l'application n'a rien affiché quelques secondes après le
 * chargement (module en erreur pendant une mise à jour, fichier servi à moitié écrit,
 * morceau de bundle périmé), on affiche « Mise à jour en cours… » et on recharge la page.
 * Rechargements bornés par onglet ; au-delà, un bouton laisse la main à l'utilisateur.
 * Script classique (pas un module) : il tourne même quand le graphe de modules échoue.
 */
(function () {
  var KEY = 'cfao-boot-retries'
  var MAX = 8
  var WAIT_MS = 4000
  var RETRY_MS = 3000
  var SPLASH_MS = 300
  var FADE_DELAY_MS = 300
  var HANG_MS = 60000
  var en = (navigator.language || '').toLowerCase().indexOf('fr') !== 0
  var txt = en
    ? { loading: 'Loading…', title: 'Update in progress…', body: 'The page reloads by itself in a moment.', stuck: 'The page still does not load.', btn: 'Reload' }
    : { loading: 'Chargement…', title: 'Mise à jour en cours…', body: 'La page se recharge d’elle-même dans un instant.', stuck: 'La page ne se charge toujours pas.', btn: 'Recharger' }

  function store(fn) { try { return fn(window.sessionStorage) } catch (e) { return null } }
  function rendered() {
    var root = document.getElementById('root')
    return !!(root && root.childNodes.length)
  }
  function show(stuck) {
    var root = document.getElementById('root')
    if (!root || rendered()) return
    var box = document.createElement('div')
    box.setAttribute('role', 'status')
    box.style.cssText = 'min-height:100vh;display:flex;align-items:center;justify-content:center;'
      + 'font-family:"DM Sans",system-ui,sans-serif;background:#f5f6f8;color:#0e1126'
    var card = '<div style="text-align:center;padding:28px 32px;background:#fff;border-radius:16px;'
      + 'box-shadow:0 8px 28px rgba(14,17,38,.1);max-width:360px">'
      + '<div style="font-size:17px;font-weight:700;margin-bottom:6px">' + (stuck ? txt.stuck : txt.title) + '</div>'
    card += stuck
      ? '<button type="button" style="margin-top:12px;height:36px;padding:0 18px;border:0;border-radius:10px;'
        + 'background:#0e1126;color:#fff;font:inherit;font-weight:600;cursor:pointer">' + txt.btn + '</button>'
      : '<div style="font-size:14px;color:#5b6075">' + txt.body + '</div>'
    box.innerHTML = card + '</div>'
    // Garde-fou retiré dès que l'application monte (React remplace le contenu de #root).
    box.setAttribute('data-boot-guard', '')
    root.appendChild(box)
    var btn = box.querySelector('button')
    if (btn) btn.addEventListener('click', function () { store(function (s) { s.removeItem(KEY) }); location.reload() })
  }
  function check() {
    var root = document.getElementById('root')
    if (rendered() && !root.querySelector('[data-boot-guard]')) { store(function (s) { s.removeItem(KEY) }); return }
    if (rendered()) return
    var n = Number(store(function (s) { return s.getItem(KEY) }) || 0)
    if (n >= MAX) { show(true); return }
    show(false)
    setTimeout(function () {
      if (rendered() && !document.querySelector('[data-boot-guard]')) return
      store(function (s) { s.setItem(KEY, String(n + 1)) })
      location.reload()
    }, RETRY_MS)
  }

  // Même règle que src/utils/echelle.js, qui ne tourne qu'une fois les modules reçus.
  function scale() {
    var w = (window.screen && window.screen.width) || 1920
    return w >= 1280 && w < 1920 ? Math.round(Math.max(0.8, w / 1920) * 1000) / 1000 : 1
  }

  // Indicateur de chargement : `load` n'arrive qu'une fois tous les modules reçus, ce qui peut
  // prendre plusieurs dizaines de secondes en dev. Hors de #root pour ne pas fausser rendered().
  // Même rendu que <PortalLoader> (portal.css, pas encore chargé ici) pour éviter un saut visuel.
  function watchSplash() {
    var el = null
    var timer = setInterval(function () {
      if (!rendered()) return
      clearInterval(timer)
      if (!el) return
      if (document.querySelector('[data-boot-guard]')) { el.remove(); return }
      // Reste en place le temps que le loader de l'application finisse d'apparaître dessous.
      el.style.pointerEvents = 'none'
      el.style.transition = 'opacity .25s ease ' + FADE_DELAY_MS + 'ms'
      el.style.opacity = '0'
      setTimeout(function () { el.remove() }, FADE_DELAY_MS + 250)
    }, 150)
    setTimeout(function () {
      if (rendered()) return
      var z = scale()
      if (z < 1) document.documentElement.style.zoom = String(z)
      el = document.createElement('div')
      el.setAttribute('data-boot-splash', '')
      el.setAttribute('role', 'status')
      el.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;'
        + 'overflow:hidden;background-color:#1a1f3c;font-family:"DM Sans",system-ui,sans-serif'
      el.innerHTML = '<style>@keyframes boot-splash-fill{to{transform:scaleX(1)}}</style>'
        + '<div style="position:absolute;inset:0;transform:scale(1.08);background:'
        + 'linear-gradient(rgba(14,17,38,.6),rgba(14,17,38,.6)),'
        + 'url(/assets/images_articles/event_academy2.jpg) center/cover"></div>'
        + '<div style="position:relative;display:flex;flex-direction:column;align-items:center;gap:26px;'
        + 'padding:0 24px;margin-top:calc(6vh / ' + z + ')">'
        + '<div style="display:flex;align-items:center;gap:14px">'
        + '<img src="/assets/logo-cfao-mobility.jpg" alt="" style="box-sizing:border-box;width:60px;height:60px;'
        + 'object-fit:contain;border-radius:14px;background:#fff;padding:8px;box-shadow:0 10px 34px rgba(0,0,0,.4)">'
        + '<span style="font-size:34px;font-weight:800;letter-spacing:-.02em;color:#fff">'
        + 'Academy<span style="color:#e3001b">.</span></span></div>'
        + '<div style="display:flex;flex-direction:column;align-items:center;gap:14px">'
        + '<div style="width:200px;height:3px;border-radius:999px;background:rgba(255,255,255,.14);overflow:hidden">'
        + '<span style="display:block;height:100%;width:100%;border-radius:999px;'
        + 'background:linear-gradient(90deg,#e3001b,#ff6a5d);transform-origin:left center;transform:scaleX(0);'
        + 'animation:boot-splash-fill .85s cubic-bezier(.4,0,.2,1) forwards"></span></div>'
        + '<div style="font-family:\'JetBrains Mono\',monospace;font-size:12px;font-weight:500;'
        + 'color:rgba(255,255,255,.5);letter-spacing:.04em;min-height:18px">' + txt.loading + '</div>'
        + '</div></div>'
      document.body.appendChild(el)
    }, SPLASH_MS)
  }

  var started = false
  function start() {
    if (started) return
    started = true
    setTimeout(check, WAIT_MS)
  }
  watchSplash()
  window.addEventListener('load', start)
  // Filet : un module qui ne répond jamais empêche `load`, la page resterait vide sans recours.
  setTimeout(start, HANG_MS)
})()
