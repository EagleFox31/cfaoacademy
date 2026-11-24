// node --test keycloak/tests/jauge_mot_de_passe.test.cjs
const test = require('node:test')
const assert = require('node:assert')
const { forceMotDePasse } = require('../themes/cfao-academy/login/resources/js/login.js')

test('vide : pas de niveau', () => {
  assert.strictEqual(forceMotDePasse(''), null)
})

test('court ou d’une seule sorte : très faible', () => {
  assert.strictEqual(forceMotDePasse('abc'), 0)
  assert.strictEqual(forceMotDePasse('motpasse'), 0)
})

test('suites et répétitions pénalisées', () => {
  assert.ok(forceMotDePasse('Xy123456789!') < forceMotDePasse('Xy7k2q9m4t!R'))
  assert.ok(forceMotDePasse('Aaaa-bbbb-cccc') < 3)
})

test('mots évidents et identifiant plafonnés à faible', () => {
  assert.ok(forceMotDePasse('Cfao-Academy-2026!') <= 1)
  assert.ok(forceMotDePasse('Jakaa-Ext-9!zQ', ['jakaa-ext@cfao.com']) <= 1)
})

test('long et varié : fort à très fort', () => {
  assert.ok(forceMotDePasse('Tq8!vR2m#pW5') >= 3)
  assert.strictEqual(forceMotDePasse('Tq8!vR2m#pW5zL7^'), 4)
})

test('hors politique du realm (majuscule, chiffre, spécial, 12) : faible au plus', () => {
  assert.ok(forceMotDePasse('lion vert sous la pluie de douala') <= 1)
  assert.ok(forceMotDePasse('Tq8vR2mxpW5zL7') <= 1)
  assert.ok(forceMotDePasse('tq8!vr2m#pw5zl7') <= 1)
  assert.ok(forceMotDePasse('Tq8!vR2m#pW') <= 1)
  assert.ok(forceMotDePasse('Lion vert sous la pluie, Douala 2026') >= 3)
})
