// CFAO Needs - Keycloak Login Enhancements
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
});
