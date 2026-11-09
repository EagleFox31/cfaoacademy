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
  var en = (navigator.language || '').toLowerCase().indexOf('fr') !== 0
  var txt = en
    ? { title: 'Update in progress…', body: 'The page reloads by itself in a moment.', stuck: 'The page still does not load.', btn: 'Reload' }
    : { title: 'Mise à jour en cours…', body: 'La page se recharge d’elle-même dans un instant.', stuck: 'La page ne se charge toujours pas.', btn: 'Recharger' }

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
  window.addEventListener('load', function () { setTimeout(check, WAIT_MS) })
})()
