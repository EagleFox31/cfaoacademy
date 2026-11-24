// CFAO Academy - Keycloak Login Enhancements
// Ajoute des placeholders accessibles aux champs de saisie
if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', function () {
  var lang = (document.documentElement.lang || 'fr').slice(0, 2);
  var exemples = { fr: 'ex. prenom.nom@cfao.com', pt: 'ex. nome.apelido@cfao.com' };
  var usernameInput = document.getElementById('username') || document.querySelector('input[name="username"]');
  if (usernameInput && !usernameInput.getAttribute('placeholder')) {
    usernameInput.setAttribute('placeholder', exemples[lang] || 'e.g. firstname.lastname@cfao.com');
  }

  var passwordInput = document.getElementById('password') || document.querySelector('input[name="password"]');
  if (passwordInput && !passwordInput.getAttribute('placeholder')) {
    passwordInput.setAttribute('placeholder', '••••••••••••');
  }

  // Barre minimale (cfao.css) : « ← Accueil » = la landing d'Academy (CFAO_LANDING_URL,
  // posée par login.ftl et gardée pour les pages suivantes) ; à défaut, l'accueil de
  // l'application d'où l'on vient (origine du redirect_uri). Langue à droite. Keycloak peut être
  // servi sur un autre hôte que l'application : sa racine « / » renverrait vers une
  // autre application, voire vers cette même page de connexion. Le logo reste
  // dans la carte seulement. Créée dans <body>, hors de .login-pf-page, pour
  // échapper à la règle des liens de la carte.
  function accueilApplication() {
    try {
      var retour = new URLSearchParams(window.location.search).get('redirect_uri');
      // CFAO_LANDING_URL : une ou plusieurs adresses (séparées par des espaces), par
      // exemple zrok et IP. On prend celle du même hôte que l'application appelante,
      // sinon la première.
      var landing = document.getElementById('cfao-accueil');
      var cibles = ((landing && landing.getAttribute('data-href')) || '').split(/\s+/)
        .filter(function (u) { return /^https?:\/\//i.test(u); });
      if (cibles.length) {
        var hote = retour ? new URL(retour).hostname : '';
        var cible = cibles.filter(function (u) { return new URL(u).hostname === hote; })[0] || cibles[0];
        window.sessionStorage.setItem('cfaoAccueil', cible);
        return cible;
      }
      // redirect_uri n'est lu que sur le formulaire de connexion : Keycloak l'a alors
      // déjà validé contre le client (pas de redirection ouverte via une page d'erreur).
      if (retour && document.getElementById('kc-form-login')) {
        var origine = new URL(retour).origin + '/';
        window.sessionStorage.setItem('cfaoAccueil', origine);
        return origine;
      }
      return window.sessionStorage.getItem('cfaoAccueil') || '/';
    } catch (e) {
      return '/';
    }
  }
  if (!document.querySelector('.cfao-topbar')) {
    var accueil = { fr: 'Accueil', pt: 'Início' };
    var barre = document.createElement('header');
    barre.className = 'cfao-topbar';
    var home = document.createElement('a');
    home.className = 'cfao-topbar-home';
    home.href = accueilApplication();
    home.textContent = accueil[lang] || 'Home';
    barre.appendChild(home);
    // Sélecteur de Keycloak déplacé, pas recréé : son menu garde ses écouteurs.
    var locale = document.getElementById('kc-locale');
    if (locale) {
      barre.appendChild(locale);
    }
    document.body.insertBefore(barre, document.body.firstChild);
  }

  relancerAvantExpiration();
  jaugeMotDePasse(lang);

  // Chaque langue écrite dans sa propre langue (« English », pas « Anglais (English) »),
  // avec son attribut lang pour les lecteurs d'écran.
  var endonymes = { fr: 'Français', en: 'English', pt: 'Português' };
  document.querySelectorAll('#kc-locale ul a[href*="kc_locale="]').forEach(function (lien) {
    var code = (lien.getAttribute('href').match(/kc_locale=([a-z-]+)/i) || [])[1];
    if (code && endonymes[code]) {
      lien.textContent = endonymes[code];
      lien.setAttribute('lang', code);
      lien.setAttribute('hreflang', code);
    }
  });
});

// Page de connexion laissée ouverte : la tentative de connexion de Keycloak expire
// au bout de 30 min (délai par défaut du realm). Avant cela, la page relance la
// connexion d'elle-même (même adresse que le lien « Recommencer » de Keycloak),
// sans message ni clic : l'utilisateur ne voit jamais « délai expiré ». Pas de
// relance pendant la saisie ; l'identifiant (jamais le mot de passe) est reporté.
var CFAO_RELANCE_MS = 25 * 60 * 1000;
var CFAO_INACTIF_MS = 60 * 1000;
var CFAO_EXPIRE_MS = 29 * 60 * 1000;

function adresseRelance(formulaire) {
  try {
    var action = new URL(formulaire.action, window.location.href);
    if (!/\/login-actions\/authenticate$/.test(action.pathname)) return null;
    var relance = new URL(action.pathname.replace(/authenticate$/, 'restart'), action.origin);
    ['client_id', 'tab_id', 'client_data'].forEach(function (cle) {
      var valeur = action.searchParams.get(cle);
      if (valeur) relance.searchParams.set(cle, valeur);
    });
    relance.searchParams.set('skip_logout', 'true');
    return relance.searchParams.get('client_id') ? relance.href : null;
  } catch (e) {
    return null;
  }
}

function relancerAvantExpiration() {
  var formulaire = document.getElementById('kc-form-login');
  var identifiant = document.getElementById('username');
  if (!formulaire) return;
  var cible = adresseRelance(formulaire);
  if (!cible) return;

  try {
    var reporte = window.sessionStorage.getItem('cfaoIdentifiant');
    var relancee = window.sessionStorage.getItem('cfaoRelance') === '1';
    window.sessionStorage.removeItem('cfaoIdentifiant');
    window.sessionStorage.removeItem('cfaoRelance');
    if (reporte && identifiant && !identifiant.value) identifiant.value = reporte;
    // Relance après une expiration déjà passée (poste en veille) : Keycloak sert un
    // formulaire neuf et valable mais y joint « délai expiré ». Message sans objet ici :
    // retiré, seulement quand c'est cette page qui a relancé.
    if (relancee) {
      document.querySelectorAll('.alert-error').forEach(function (alerte) {
        if (!alerte.closest('form')) alerte.remove();
      });
    }
  } catch (e) { /* stockage indisponible : rien à reporter */ }

  var debut = Date.now();
  var derniereSaisie = 0;
  ['input', 'keydown'].forEach(function (evenement) {
    formulaire.addEventListener(evenement, function () { derniereSaisie = Date.now(); });
  });

  function relancer() {
    try {
      window.sessionStorage.setItem('cfaoRelance', '1');
      if (identifiant && identifiant.value) window.sessionStorage.setItem('cfaoIdentifiant', identifiant.value);
    } catch (e) { /* stockage indisponible : l'identifiant sera ressaisi */ }
    window.location.replace(cible);
  }

  function verifier() {
    var maintenant = Date.now();
    var inactif = document.hidden || maintenant - derniereSaisie > CFAO_INACTIF_MS;
    if (maintenant - debut > CFAO_RELANCE_MS && inactif) relancer();
  }

  // Envoi d'un formulaire déjà expiré (poste resté en veille) : relance plutôt qu'erreur.
  formulaire.addEventListener('submit', function (evenement) {
    if (Date.now() - debut > CFAO_EXPIRE_MS) {
      evenement.preventDefault();
      relancer();
    }
  });
  // Les minuteries sont ralenties en arrière-plan ou en veille : contrôle aussi au retour.
  document.addEventListener('visibilitychange', verifier);
  window.addEventListener('focus', verifier);
  window.setInterval(verifier, 30 * 1000);
}

// Jauge de force du nouveau mot de passe (pages « mettre à jour » et « réinitialiser »
// le mot de passe, champ #password-new). Indicative : la règle qui fait foi est la
// politique de mot de passe du realm. Rien n'est envoyé, tout se calcule dans la page.
var CFAO_MOTS_FAIBLES = ['cfao', 'academy', 'password', 'motdepasse', 'senha', 'azerty', 'qwerty',
  'admin', 'demo', 'welcome', 'bienvenue', 'soleil', 'toyota', 'mobility'];

/** Force de 0 (très faible) à 4 (très fort) ; null si vide. `interdits` : identifiant, e-mail. */
function forceMotDePasse(mdp, interdits) {
  if (!mdp) return null;
  var bas = mdp.toLowerCase();
  var classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/]
    .filter(function (motif) { return motif.test(mdp); }).length;
  var score = mdp.length < 8 ? 0 : mdp.length < 12 ? 1 : mdp.length < 16 ? 2 : 3;
  if (classes >= 3) score += 1;
  if (classes === 1 && mdp.length < 20) score -= 1;
  // Même caractère 3 fois de suite, ou suite évidente (abc, 123, azerty).
  if (/(.)\1\1/.test(mdp) || /(abc|bcd|cde|123|234|345|456|567|678|789|890|987|321)/.test(bas)) score -= 1;
  var mots = CFAO_MOTS_FAIBLES.concat((interdits || []).reduce(function (liste, valeur) {
    return liste.concat(String(valeur || '').toLowerCase().split(/[@._\-\s]+/));
  }, []));
  var contientMot = mots.some(function (mot) { return mot.length >= 4 && bas.indexOf(mot) !== -1; });
  if (contientMot) score = Math.min(score, 1);
  // Refusé par la politique du realm (12 caractères, une majuscule, un chiffre, un
  // caractère spécial) : jamais au-dessus de « faible ».
  if (!respectePolitique(mdp)) score = Math.min(score, 1);
  return Math.max(0, Math.min(4, score));
}

/** Miroir de `passwordPolicy` dans keycloak/config/cfao-realm.yaml. */
function respectePolitique(mdp) {
  return mdp.length >= 12 && /[A-Z]/.test(mdp) && /[0-9]/.test(mdp) && /[^A-Za-z0-9]/.test(mdp);
}

function jaugeMotDePasse(lang) {
  var champ = document.getElementById('password-new');
  if (!champ || document.querySelector('.cfao-jauge')) return;
  var textes = {
    fr: { niveaux: ['Très faible', 'Faible', 'Moyen', 'Fort', 'Très fort'], titre: 'Force du mot de passe',
      conseil: 'Au moins 12 caractères, dont une majuscule, un chiffre et un caractère spécial (! ? # …). Évitez votre nom et « cfao ».' },
    en: { niveaux: ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'], titre: 'Password strength',
      conseil: 'At least 12 characters, including an uppercase letter, a digit and a special character (! ? # …). Avoid your name and "cfao".' },
    pt: { niveaux: ['Muito fraca', 'Fraca', 'Média', 'Forte', 'Muito forte'], titre: 'Força da senha',
      conseil: 'Pelo menos 12 caracteres, com uma maiúscula, um número e um caractere especial (! ? # …). Evite seu nome e "cfao".' },
  }[lang] || null;
  if (!textes) textes = { niveaux: ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'], titre: 'Password strength',
    conseil: 'At least 12 characters, including an uppercase letter, a digit and a special character (! ? # …).' };
  var couleurs = ['#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#15803d'];

  if (!document.getElementById('cfao-jauge-style')) {
    var style = document.createElement('style');
    style.id = 'cfao-jauge-style';
    style.textContent =
      '.cfao-jauge{margin:8px 0 4px}' +
      '.cfao-jauge-barres{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}' +
      '.cfao-jauge-barres span{height:6px;border-radius:3px;background:#e5e7eb;transition:background .2s}' +
      '.cfao-jauge-ligne{display:flex;justify-content:space-between;gap:8px;margin-top:6px;font-size:13px}' +
      '.cfao-jauge-niveau{font-weight:600}' +
      '.cfao-jauge-conseil{margin:4px 0 0;font-size:12px;color:#6b7280}';
    document.head.appendChild(style);
  }

  var jauge = document.createElement('div');
  jauge.className = 'cfao-jauge';
  var barres = document.createElement('div');
  barres.className = 'cfao-jauge-barres';
  barres.setAttribute('aria-hidden', 'true');
  for (var i = 0; i < 4; i++) barres.appendChild(document.createElement('span'));
  var ligne = document.createElement('div');
  ligne.className = 'cfao-jauge-ligne';
  var titre = document.createElement('span');
  titre.textContent = textes.titre;
  var niveau = document.createElement('span');
  niveau.className = 'cfao-jauge-niveau';
  niveau.setAttribute('aria-live', 'polite');
  ligne.appendChild(titre);
  ligne.appendChild(niveau);
  var conseil = document.createElement('p');
  conseil.className = 'cfao-jauge-conseil';
  conseil.textContent = textes.conseil;
  jauge.appendChild(barres);
  jauge.appendChild(ligne);
  jauge.appendChild(conseil);

  // Sous le groupe champ + bouton « afficher », pas entre les deux.
  var ancre = champ.closest('.pf-c-input-group, .pf-v5-c-input-group, .kc-input-group') || champ;
  ancre.insertAdjacentElement('afterend', jauge);

  var identifiant = document.getElementById('username');
  var interdits = [identifiant && identifiant.value];

  function majJauge() {
    var force = forceMotDePasse(champ.value, interdits);
    var pleines = force === null ? 0 : Math.max(1, force);
    Array.prototype.forEach.call(barres.children, function (barre, rang) {
      barre.style.background = rang < pleines ? couleurs[force] : '';
    });
    niveau.textContent = force === null ? '' : textes.niveaux[force];
    niveau.style.color = force === null ? '' : couleurs[force];
  }
  champ.addEventListener('input', majJauge);
  majJauge();
}

// Tests (node) : le calcul de la force, sans navigateur.
if (typeof module !== 'undefined' && module.exports) module.exports = { forceMotDePasse: forceMotDePasse };
