import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const src = path.resolve(__dirname, '../../catalogues')
const dest = path.resolve(__dirname, '../public/catalogues')

if (!fs.existsSync(src)) {
  console.warn('[sync-catalogues] Dossier source introuvable:', src)
  process.exit(0)
}

// Lien posé sur le poste (chemin Windows absolu) et monté dans un conteneur Linux :
// sa cible n'existe pas ici. On ne l'écrase pas ; vite sert ../catalogues en repli.
const destLink = fs.lstatSync(dest, { throwIfNoEntry: false })
if (destLink?.isSymbolicLink() && !fs.existsSync(dest)) {
  console.warn('[sync-catalogues] Lien cassé ignoré (repli vite sur ../catalogues) :', dest)
  process.exit(0)
}

try {
  const srcReal = fs.realpathSync(src)
  const destReal = fs.existsSync(dest) ? fs.realpathSync(dest) : null
  if (destReal && srcReal === destReal) {
    console.log('[sync-catalogues] Déjà lié au dossier projet (aucune copie nécessaire).')
    process.exit(0)
  }
} catch {
  /* continue */
}

fs.mkdirSync(path.dirname(dest), { recursive: true })
fs.cpSync(src, dest, { recursive: true, force: true })
console.log('[sync-catalogues] OK →', dest)
