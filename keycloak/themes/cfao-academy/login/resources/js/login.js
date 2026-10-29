// CFAO Academy - Keycloak Login Enhancements
// Ajoute des placeholders accessibles aux champs de saisie
document.addEventListener('DOMContentLoaded', function () {
  var usernameInput = document.getElementById('username') || document.querySelector('input[name="username"]');
  if (usernameInput && !usernameInput.getAttribute('placeholder')) {
    usernameInput.setAttribute('placeholder', 'ex. prenom.nom@cfao.com');
  }

  var passwordInput = document.getElementById('password') || document.querySelector('input[name="password"]');
  if (passwordInput && !passwordInput.getAttribute('placeholder')) {
    passwordInput.setAttribute('placeholder', '••••••••••••');
  }

  // Fermer = revenir à la porte d'entrée : la racine du domaine, quel que soit
  // l'hôte (zrok, LAN). Lien réel, donc focusable et lisible au clavier.
  var card = document.querySelector('.login-pf-page .card-pf');
  if (card && !card.querySelector('.cfao-close')) {
    var libelles = { fr: 'Fermer et revenir à l\'accueil', pt: 'Fechar e voltar ao início' };
    var lang = (document.documentElement.lang || 'fr').slice(0, 2);
    var close = document.createElement('a');
    close.className = 'cfao-close';
    close.href = '/';
    close.setAttribute('aria-label', libelles[lang] || 'Close and return to home');
    close.textContent = '✕';
    card.appendChild(close);
  }
});
