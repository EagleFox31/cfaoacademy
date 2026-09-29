import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoCatalogues = path.resolve(__dirname, '../catalogues')

const MIME = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
}

/** Sert aussi `../catalogues` (source projet) si le fichier n’est pas dans `public/catalogues`. */
function cataloguesFallbackPlugin() {
  return {
    name: 'catalogues-fallback',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = req.url?.split('?')[0] ?? ''
        if (!raw.startsWith('/catalogues/')) return next()

        const rel = decodeURIComponent(raw.slice('/catalogues/'.length))
        if (!rel || rel.includes('..')) return next()

        const publicPath = path.join(__dirname, 'public', 'catalogues', rel)
        if (fs.existsSync(publicPath) && fs.statSync(publicPath).isFile()) return next()

        const repoPath = path.join(repoCatalogues, rel)
        if (!fs.existsSync(repoPath) || !fs.statSync(repoPath).isFile()) return next()

        const ext = path.extname(repoPath).toLowerCase()
        res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream')
        fs.createReadStream(repoPath).pipe(res)
      })
    },
  }
}

/**
 * Unites d'ecran compensees de la mise a l'echelle (cf. src/utils/echelle.js).
 * Sous `zoom`, `100vh` ne couvre plus que 80 % de la fenetre : chaque
 * `vh`/`vw` est divise par `--echelle` pour garder sa taille a l'ecran.
 */
const unitesEcran = {
  postcssPlugin: 'unites-ecran',
  Declaration(decl) {
    if (decl.value.includes('--echelle')) return
    decl.value = decl.value.replace(/(^|[^\w.-])(-?\d*\.?\d+)([dsl]?v(?:h|w|min|max))(?![\w-])/g,
      '$1calc($2$3 / var(--echelle, 1))')
  },
}

// Le BFF de la stack Docker (service oauth2-proxy, point d'entree sur le port 8000).
const BFF = process.env.CFAO_BFF || 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react(), cataloguesFallbackPlugin()],
  css: { postcss: { plugins: [unitesEcran] } },
  publicDir: 'public',
  server: {
    fs: { allow: ['..'] },
    proxy: {
      // Le rendu des rapports (LibreOffice, service `rapports`) passe lui
      // aussi par le BFF : il exige le jeton que le BFF reinjecte.
      '/apercu': { target: BFF, changeOrigin: false },
      // Les API de la plateforme passent par le BFF (oauth2-proxy), comme en
      // production : le navigateur ne parle qu'a cette origine et garde son
      // cookie de session (architecture_complement.md §5, « En dev local »).
      '/api': { target: BFF, changeOrigin: false },
      '/oauth2': { target: BFF, changeOrigin: false },
      '/medacap-api': {
        target: 'http://localhost',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/medacap-api/, '/medacap'),
      },
    },
  },
})
