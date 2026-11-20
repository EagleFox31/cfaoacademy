// CFAO Academy - Keycloak Login Enhancements
// Ajoute des placeholders accessibles aux champs de saisie
document.addEventListener('DOMContentLoaded', function () {
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
