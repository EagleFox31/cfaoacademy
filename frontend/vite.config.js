import { defineConfig, loadEnv } from 'vite'
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

/**
 * Sans VITE_CR_URL, le build de production renvoie les comptes rendus vers
 * http://localhost:8090 : inutilisable hors du poste de dev. On prévient
 * sans faire échouer le build (la CI le lance sans variable).
 */
function avertirSansUrlComptesRendus(mode) {
  const env = { ...loadEnv(mode, __dirname, 'VITE_'), ...process.env }
  return {
    name: 'avertir-sans-vite-cr-url',
    apply: 'build',
    buildStart() {
      if (mode === 'production' && !env.VITE_CR_URL) {
        console.warn('[avertissement] VITE_CR_URL n’est pas définie : en production, les liens des '
          + 'comptes rendus pointent sur http://localhost:8090. Renseignez l’adresse publique du module '
          + '(voir docs/DEPLOYMENT.md, « Module des comptes rendus »).')
      }
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), cataloguesFallbackPlugin(), avertirSansUrlComptesRendus(mode)],
  css: { postcss: { plugins: [unitesEcran] } },
  publicDir: 'public',
  server: {
    host: '0.0.0.0',
    port: 5173,
    fs: { allow: ['..'] },
    // Dans Docker sous Windows, le montage ne remonte pas les événements fichiers :
    // VITE_POLLING=1 active la scrutation pour garder le HMR. Chaque fichier scruté
    // coûte un stat à travers le montage : à 300 ms sur tout le dossier, la file d'E/S
    // de node ne se vide plus et un simple index.html attend plusieurs secondes.
    watch: process.env.VITE_POLLING
      ? {
        usePolling: true,
        interval: 1000,
        binaryInterval: 3000,
        ignored: ['**/dist/**', '**/coverage/**', '**/public/assets/**', '**/public/catalogues/**'],
      }
      : undefined,
    // Cibles surchargeables : en conteneur, localhost désigne le conteneur lui-même.
    proxy: {
      // Avant '/api/v1' : vite prend la première règle qui correspond.
      '/api/v1/planning': {
        target: process.env.PLANNING_SERVICE || 'http://localhost:8005',
        changeOrigin: true,
      },
      '/api/v1': {
        target: process.env.GATEWAY_SERVICE || 'http://localhost:8000',
        changeOrigin: true,
      },
      '/realms': {
        target: process.env.KEYCLOAK_SERVICE || 'http://localhost:8080',
        changeOrigin: true,
      },
      // La session du formateur (connexion par compte), tenue par le service
      // des comptes rendus. L'interface des comptes rendus, elle, est servie
      // a part : cfao-comptes-rendus/web.
      '/cr-donnees': {
        target: process.env.CR_SERVICE || 'http://127.0.0.1:5175',
        changeOrigin: true,
      },
      '/medacap-api': {
        target: process.env.MEDACAP_SERVICE || 'http://localhost',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/medacap-api/, '/medacap'),
      },
    },
  },
}))
