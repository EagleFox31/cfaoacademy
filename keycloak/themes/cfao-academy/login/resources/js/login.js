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
