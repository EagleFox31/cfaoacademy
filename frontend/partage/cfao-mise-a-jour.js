/*! cfao-mise-a-jour.js — version 1.1.0
 *
 * « Une nouvelle version est disponible » pour les modules CFAO Academy (cr, needs,
 * planning, medacap…). Fichier autonome : un seul script, sans dépendance, FR/EN/PT.
 * Source : frontend/partage/ du dépôt cfaoacademy ; le portail en a l'équivalent React
 * (frontend/src/components/MiseAJourDisponible.jsx). Copier le fichier tel quel : le
 * numéro ci-dessus repère les copies périmées.
 *
 * Contrat : GET <préfixe>/version.json →
 *   { module, version, build, critical?, min_client?, notes_key? }
 * servi en Cache-Control: no-store, écrit au build. Tout échec de lecture = silence.
 *
 * Usage (aucune adresse en dur : chaque module donne la sienne) :
 *   <script src="…/cfao-mise-a-jour.js"></script>
 *   CfaoMiseAJour.demarrer({
 *     url: '/cr/version.json',            // obligatoire
 *     module: 'cr', version: '1.4.0',     // ceux de CE code, posés au build
 *     build: 'xxxx',                      // identique à celui de version.json au même build
 *     langue: 'fr',                       // sinon <html lang>, sinon fr
 *     notes: { cle: 'texte' },            // facultatif : textes des notes_key
 *   })
 *   CfaoMiseAJour.registerBeforeReload('brouillon', () => donnees)   // à garder
 *   CfaoMiseAJour.registerAfterReload('brouillon', (donnees) => {…}) // à remettre
 *
 * Affichage : barre pleine largeur tout en haut. Tant qu'elle est là, <html> porte la
 * classe cfao-nv-actif et --cfao-maj-h vaut sa hauteur ; le <body> descend d'autant.
 * Une nav collante ou fixe du module se cale dessous avec : top: var(--cfao-maj-h, 0px).
 *
 * 1.1.0 : barre en haut (au lieu d'une carte en bas), sans numéro de version affiché.
 */
(function (global) {
  'use strict'

  var VERSION = '1.1.0'
  var RAPPEL_MS = 30 * 60000
  var INTERVALLE_MS = 10 * 60000
  var ECART_MIN_MS = 60000

  var TEXTES = {
    fr: {
      titre: 'Une nouvelle version est disponible',
      texte: 'Actualisez la page pour obtenir les dernières corrections.',
      version: 'Version {version}',
      actualiser: 'Actualiser maintenant',
      plusTard: 'Plus tard',
      rappel: '« Plus tard » : nouveau rappel dans 30 minutes.',
      titreCritique: 'Mise à jour nécessaire',
      texteCritique: 'Cette version de la page n’est plus prise en charge. Actualisez pour continuer à travailler.',
    },
    en: {
      titre: 'A new version is available',
      texte: 'Refresh the page to get the latest fixes.',
      version: 'Version {version}',
      actualiser: 'Refresh now',
      plusTard: 'Later',
      rappel: '“Later”: we will remind you again in 30 minutes.',
      titreCritique: 'Update required',
      texteCritique: 'This version of the page is no longer supported. Refresh to keep working.',
    },
    pt: {
      titre: 'Uma nova versão está disponível',
      texte: 'Atualize a página para obter as correções mais recentes.',
      version: 'Versão {version}',
      actualiser: 'Atualizar agora',
      plusTard: 'Mais tarde',
      rappel: '“Mais tarde”: novo lembrete daqui a 30 minutos.',
      titreCritique: 'Atualização necessária',
      texteCritique: 'Esta versão da página já não é suportada. Atualize para continuar a trabalhar.',
    },
  }

  var STYLE = ''
    // Barre d'information pleine largeur tout en haut ; la page descend de sa hauteur.
    + '.cfao-nv-bandeau{position:fixed;top:0;left:0;right:0;z-index:9000;box-sizing:border-box;'
    + 'display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:8px 12px;padding:8px 16px;'
    + 'background:#1d4ed8;color:#fff;box-shadow:0 2px 10px rgba(10,18,40,.18);font:14px/1.4 system-ui,sans-serif}'
    + 'html.cfao-nv-actif body{padding-top:var(--cfao-maj-h,0px)}'
    + '.cfao-nv-texte{margin:0}.cfao-nv-texte strong{font-weight:700;margin-right:8px}'
    + '.cfao-nv-texte span{color:rgba(255,255,255,.88)}'
    + '.cfao-nv-actions{display:flex;gap:8px;flex-shrink:0}'
    + '.cfao-nv-bandeau .cfao-nv-btn{height:34px;border-radius:8px;border-color:rgba(255,255,255,.55);'
    + 'background:transparent;color:#fff}.cfao-nv-bandeau .cfao-nv-btn:hover{background:rgba(255,255,255,.12)}'
    + '.cfao-nv-bandeau .cfao-nv-principal{border-color:#fff;background:#fff;color:#1d4ed8}'
    + '.cfao-nv-bandeau .cfao-nv-principal:hover{background:#e8eefc}'
    + '.cfao-nv-bandeau .cfao-nv-btn:focus-visible{outline-color:#fff}'
    + '.cfao-nv-btn{height:38px;padding:0 16px;border:1px solid #d5dae4;border-radius:10px;background:#fff;'
    + 'color:#0b1f4b;font:inherit;font-weight:600;cursor:pointer;white-space:nowrap}'
    + '.cfao-nv-btn:hover{background:#f3f5f9}.cfao-nv-btn:focus-visible{outline:2px solid #0b1f4b;outline-offset:2px}'
    + '.cfao-nv-principal{border-color:#0b1f4b;background:#0b1f4b;color:#fff}.cfao-nv-principal:hover{background:#142c63}'
    + '.cfao-nv-voile{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:16px;'
    + 'background:rgba(10,18,40,.62);backdrop-filter:blur(3px)}'
    + '.cfao-nv-modale{width:min(460px,100%);box-sizing:border-box;padding:28px;border-radius:20px;background:#fff;'
    + 'box-shadow:0 24px 60px rgba(10,18,40,.35);text-align:center;color:#0f172a;font:14px/1.5 system-ui,sans-serif}'
    + '.cfao-nv-modale h2{margin:0 0 8px;font-size:20px}.cfao-nv-modale p{margin:0 0 12px;color:#64748b}'
    + '@media (max-width:640px){.cfao-nv-texte span{display:none}.cfao-nv-actions{width:100%}'
    + '.cfao-nv-actions .cfao-nv-btn{flex:1}}'

  var sauvegardes = {}
  var options = null
  var derniere = 0
  var element = null

  function session() {
    try { return global.sessionStorage } catch (e) { return null }
  }
  function lire(cle) {
    try { var b = session() && session().getItem(cle); return b ? JSON.parse(b) : null } catch (e) { return null }
  }
  function ecrire(cle, valeur) {
    try {
      var s = session()
      if (!s) return
      if (valeur === null) s.removeItem(cle)
      else s.setItem(cle, JSON.stringify(valeur))
    } catch (e) { /* stockage plein ou interdit */ }
  }
  function cle(nom) { return 'cfao.maj-' + nom + '.' + ((options && options.module) || 'module') }

  function registerBeforeReload(nom, sauver) {
    sauvegardes[nom] = sauver
    return function () { if (sauvegardes[nom] === sauver) delete sauvegardes[nom] }
  }

  function registerAfterReload(nom, restaurer) {
    var etat = lire('cfao.maj-etat')
    if (!etat || !Object.prototype.hasOwnProperty.call(etat, nom)) return
    var donnees = etat[nom]
    delete etat[nom]
    ecrire('cfao.maj-etat', Object.keys(etat).length ? etat : null)
    try { restaurer(donnees) } catch (e) { /* n'empêche pas les autres */ }
  }

  function actualiser() {
    var etat = {}
    var n = 0
    Object.keys(sauvegardes).forEach(function (nom) {
      try {
        var d = sauvegardes[nom]()
        if (d !== undefined) { etat[nom] = d; n += 1 }
      } catch (e) { /* on garde ce qui peut l'être */ }
    })
    if (n) ecrire('cfao.maj-etat', etat)
    global.location.reload()
  }

  function comparerVersions(a, b) {
    function l(v) { var m = /^v?(\d+(?:\.\d+)*)/i.exec(String(v == null ? '' : v).trim()); return m ? m[1].split('.').map(Number) : null }
    var x = l(a), y = l(b)
    if (!x || !y) return null
    for (var i = 0; i < Math.max(x.length, y.length); i += 1) {
      var d = (x[i] || 0) - (y[i] || 0)
      if (d) return d > 0 ? 1 : -1
    }
    return 0
  }

  function evaluer(distant) {
    if (!distant || typeof distant !== 'object' || !options.build) return null
    var build = distant.build == null ? '' : String(distant.build)
    if (!build || build === String(options.build)) return null
    if (distant.module && options.module && distant.module !== options.module) return null
    return {
      version: typeof distant.version === 'string' ? distant.version : '',
      critique: distant.critical === true
        || (distant.min_client != null && comparerVersions(options.version, distant.min_client) === -1),
      notesKey: typeof distant.notes_key === 'string' ? distant.notes_key : '',
    }
  }

  function textes() {
    var l = String(options.langue || (global.document.documentElement.lang || 'fr')).slice(0, 2).toLowerCase()
    return TEXTES[l] || TEXTES.fr
  }

  function noeud(balise, classe, texte) {
    var n = global.document.createElement(balise)
    if (classe) n.className = classe
    if (texte) n.textContent = texte
    return n
  }

  function bouton(texte, principal, action) {
    var b = noeud('button', 'cfao-nv-btn' + (principal ? ' cfao-nv-principal' : ''), texte)
    b.type = 'button'
    b.addEventListener('click', action)
    return b
  }

  // Hauteur de la barre, exposée en --cfao-maj-h pour décaler la page et la nav du module.
  function mesurer() {
    var racine = global.document.documentElement
    if (element && element.className === 'cfao-nv-bandeau') {
      racine.classList.add('cfao-nv-actif')
      racine.style.setProperty('--cfao-maj-h', element.offsetHeight + 'px')
    } else {
      racine.classList.remove('cfao-nv-actif')
      racine.style.removeProperty('--cfao-maj-h')
    }
  }

  function fermer() {
    if (element && element.parentNode) element.parentNode.removeChild(element)
    element = null
    mesurer()
  }

  function afficher(offre) {
    var doc = global.document
    if (!doc.getElementById('cfao-nv-style')) {
      var st = noeud('style')
      st.id = 'cfao-nv-style'
      st.textContent = STYLE
      doc.head.appendChild(st)
      global.addEventListener('resize', mesurer)
    }
    fermer()
    var t = textes()
    var version = offre.version ? t.version.replace('{version}', offre.version) : ''
    var notes = offre.notesKey && options.notes ? options.notes[offre.notesKey] : ''
    if (offre.critique) {
      element = noeud('div', 'cfao-nv-voile')
      var modale = noeud('div', 'cfao-nv-modale')
      modale.setAttribute('role', 'alertdialog')
      modale.setAttribute('aria-modal', 'true')
      modale.setAttribute('aria-label', t.titreCritique)
      modale.appendChild(noeud('h2', '', t.titreCritique))
      modale.appendChild(noeud('p', '', t.texteCritique))
      if (notes) modale.appendChild(noeud('p', '', notes))
      if (version) modale.appendChild(noeud('p', '', version))
      var b = bouton(t.actualiser, true, actualiser)
      modale.appendChild(b)
      element.appendChild(modale)
      doc.body.appendChild(element)
      b.focus()
      return
    }
    element = noeud('div', 'cfao-nv-bandeau')
    element.setAttribute('role', 'status')
    element.setAttribute('aria-live', 'polite')
    // Pas de numéro de version ici : il ne dit rien à l'utilisateur.
    var zone = noeud('p', 'cfao-nv-texte')
    zone.appendChild(noeud('strong', '', t.titre))
    zone.appendChild(noeud('span', '', notes || t.texte))
    var actions = noeud('div', 'cfao-nv-actions')
    actions.appendChild(bouton(t.actualiser, true, actualiser))
    var plusTard = bouton(t.plusTard, false, function () {
      ecrire(cle('plus-tard'), { jusqua: Date.now() + RAPPEL_MS })
      fermer()
    })
    plusTard.title = t.rappel
    plusTard.setAttribute('aria-label', t.plusTard + ' — ' + t.rappel)
    actions.appendChild(plusTard)
    element.appendChild(zone)
    element.appendChild(actions)
    doc.body.appendChild(element)
    mesurer()
  }

  function verifier() {
    derniere = Date.now()
    if (typeof global.fetch !== 'function') return
    global.fetch(options.url + (options.url.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now(),
      { cache: 'no-store', credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : null })
      .then(function (distant) {
        var offre = evaluer(distant)
        if (!offre) return
        var report = lire(cle('plus-tard'))
        if (!offre.critique && report && Date.now() < report.jusqua) return
        if (element && !offre.critique) return
        afficher(offre)
      })
      .catch(function () { /* silence */ })
  }

  function demarrer(opts) {
    if (options || !opts || !opts.url || !opts.build) return
    options = opts
    verifier()
    global.setInterval(verifier, opts.intervalle || INTERVALLE_MS)
    global.document.addEventListener('visibilitychange', function () {
      if (global.document.visibilityState === 'visible' && Date.now() - derniere >= ECART_MIN_MS) verifier()
    })
    global.addEventListener('vite:preloadError', verifier)
  }

  global.CfaoMiseAJour = {
    VERSION: VERSION,
    demarrer: demarrer,
    verifier: function () { if (options) verifier() },
    actualiser: actualiser,
    registerBeforeReload: registerBeforeReload,
    registerAfterReload: registerAfterReload,
  }
})(typeof window !== 'undefined' ? window : this)
