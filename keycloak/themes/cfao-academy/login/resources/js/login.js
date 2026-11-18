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

  // Barre minimale (cfao.css) : « ← Accueil » = retour à la porte d'entrée (racine
  // du domaine, quel que soit l'hôte : zrok, LAN), langue à droite. Le logo reste
  // dans la carte seulement. Créée dans <body>, hors de .login-pf-page, pour
  // échapper à la règle des liens de la carte.
  if (!document.querySelector('.cfao-topbar')) {
    var accueil = { fr: 'Accueil', pt: 'Início' };
    var barre = document.createElement('header');
    barre.className = 'cfao-topbar';
    var home = document.createElement('a');
    home.className = 'cfao-topbar-home';
    home.href = '/';
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
