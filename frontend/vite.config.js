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
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.txt': 'text/plain; charset=utf-8',
}

function envoyer(req, res, fichier) {
  const st = fs.statSync(fichier)
  const date = st.mtime.toUTCString()
  res.setHeader('Content-Type', MIME[path.extname(fichier).toLowerCase()] ?? 'application/octet-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Last-Modified', date)
  res.setHeader('Accept-Ranges', 'bytes')
  if (req.headers['if-modified-since'] === date) {
    res.statusCode = 304
    return res.end()
  }
  // Requêtes partielles : sans elles, le navigateur ne peut pas avancer dans une vidéo.
  const plage = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '')
  if (plage && (plage[1] || plage[2])) {
    const fin = plage[1] && plage[2] ? Math.min(Number(plage[2]), st.size - 1) : st.size - 1
    const debut = plage[1] ? Number(plage[1]) : Math.max(0, st.size - Number(plage[2]))
    if (debut > fin) {
      res.statusCode = 416
      res.setHeader('Content-Range', `bytes */${st.size}`)
      return res.end()
    }
    res.statusCode = 206
    res.setHeader('Content-Range', `bytes ${debut}-${fin}/${st.size}`)
    res.setHeader('Content-Length', fin - debut + 1)
    return fs.createReadStream(fichier, { start: debut, end: fin }).pipe(res)
  }
  res.setHeader('Content-Length', st.size)
  return fs.createReadStream(fichier).pipe(res)
}

function estFichier(p) {
  try { return fs.statSync(p).isFile() } catch { return false }
}

/**
 * Recette servie depuis un build (`vite preview`) : `public/` est lu en direct
 * au lieu d'être copié à chaque build (images montées, catalogues, et
 * `maintenance.json` que l'administrateur modifie à chaud).
 */
function publicEnDirect(req, res, next) {
  const rel = decodeURIComponent((req.url ?? '').split('?')[0]).replace(/^\/+/, '')
  if (!rel || rel.includes('..') || rel.startsWith('catalogues/')) return next()
  const fichier = path.join(__dirname, 'public', rel)
  return estFichier(fichier) ? envoyer(req, res, fichier) : next()
}

/** Sert aussi `../catalogues` (source projet) si le fichier n’est pas dans `public/catalogues`. */
function cataloguesFallbackPlugin() {
  return {
    name: 'catalogues-fallback',
    configurePreviewServer(server) {
      server.middlewares.use(publicEnDirect)
      server.middlewares.use((req, res, next) => {
        const raw = req.url?.split('?')[0] ?? ''
        if (!raw.startsWith('/catalogues/')) return next()
        const rel = decodeURIComponent(raw.slice('/catalogues/'.length))
        if (!rel || rel.includes('..')) return next()
        const fichier = path.join(repoCatalogues, rel)
        return estFichier(fichier) ? envoyer(req, res, fichier) : next()
      })
    },
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

        return envoyer(req, res, repoPath)
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

/**
 * Contrat commun des modules : GET <préfixe>/version.json →
 * { module, version, build, critical?, min_client?, notes_key? }.
 * `build` change à chaque build (recette en surveillance comprise) et est recopié dans
 * le code à la place de JETON_BUILD : un onglet ouvert sait ainsi qu'il est périmé.
 * VERSION (argument du Dockerfile), sinon celle du package.json. VERSION_CRITICAL=1
 * et VERSION_MIN_CLIENT=x.y.z demandent une actualisation sans « Plus tard ».
 */
const JETON_BUILD = '__CFAO_BUILD_ID__'
const VERSION_CODE = (process.env.VERSION || '').trim()
  || JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version

function fichierVersion(version) {
  let build = ''
  return {
    name: 'fichier-version',
    apply: 'build',
    buildStart() {
      build = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    },
    renderChunk(code) {
      return code.includes(JETON_BUILD) ? { code: code.replaceAll(JETON_BUILD, build), map: null } : null
    },
    generateBundle() {
      const contenu = { module: 'portail', version, build }
      if (/^(1|true)$/i.test(process.env.VERSION_CRITICAL || '')) contenu.critical = true
      if (process.env.VERSION_MIN_CLIENT) contenu.min_client = process.env.VERSION_MIN_CLIENT.trim()
      this.emitFile({ type: 'asset', fileName: 'version.json', source: `${JSON.stringify(contenu)}\n` })
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), cataloguesFallbackPlugin(), avertirSansUrlComptesRendus(mode), fichierVersion(VERSION_CODE)],
  define: {
    __CFAO_VERSION__: JSON.stringify(VERSION_CODE),
    __CFAO_BUILD__: JSON.stringify(JETON_BUILD),
  },
  css: { postcss: { plugins: [unitesEcran] } },
  publicDir: 'public',
  // FRONT_MODE=build (recette, frontend/compose.dev.yml) : `public/` est servi en
  // direct par `vite preview`, et le build se refait à chaque modification.
  // Surveillance activée ici, pas par `--watch` : l'option de la ligne de commande
  // remplace tout l'objet par `true` et fait perdre la scrutation (montage Windows).
  build: {
    // Drapeaux (src/utils/drapeau.js) : 271 SVG, jamais incrustés dans le JS ;
    // chacun reste un fichier, chargé seulement s'il est affiché.
    assetsInlineLimit: (fichier) => (fichier.includes('/flag-icons/') ? false : undefined),
    // Les tableaux de bord chargés à la demande tiraient ~35 morceaux de
    // quelques Ko : en HTTP/1.1 (6 connexions), 1 à 2,6 s de file d'attente.
    // Rolldown (Vite 8) n'a pas `experimentalMinChunkSize`. Mesure du 18/11 : découpage
    // par défaut = accueil 5 fichiers / 865 Ko (Vite 5 : 1 / 921 Ko), mais 110 morceaux
    // de moins de 20 Ko sur 128. Un groupe `codeSplitting.groups` des modules partagés
    // alourdit l'accueil (18 à 24 fichiers, 1,5 Mo) : écarté, à affiner par écran.
    ...(process.env.FRONT_MODE === 'build'
      ? {
        copyPublicDir: false,
        // Scrutation sur le montage Windows. Vite 8 ne lit que `chokidar` (usePolling,
        // interval) et en dérive l'option `watcher` de Rolldown : `watcher` serait écrasé.
        // Dépendances exclues : elles ne changent qu'avec le lockfile, qui relance le conteneur.
        watch: {
          chokidar: process.env.VITE_POLLING ? { usePolling: true, interval: 1000 } : {},
          exclude: ['**/node_modules/**', '**/public/**', '**/C:/**'],
        },
      }
      : {}),
  },
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
        // Restes de build (dossier `C:` d'un outDir Windows lancé dans le conteneur,
        // `vite.config.js.timestamp-*`) : des centaines de fichiers scrutés pour rien.
        ignored: ['**/dist/**', '**/coverage/**', '**/public/assets/**', '**/public/catalogues/**',
          '**/scripts/**', '**/C:/**', '**/*.timestamp-*.mjs'],
      }
      : undefined,
    // Cibles surchargeables : en conteneur, localhost désigne le conteneur lui-même.
    proxy: {
      // Avant '/api/v1' : vite prend la première règle qui correspond.
      '/api/v1/planning': {
        target: process.env.PLANNING_SERVICE || 'http://localhost:8005',
        changeOrigin: true,
      },
      '/api/v1/supervision': {
        target: process.env.SUPERVISION_SERVICE || 'http://localhost:8007',
        changeOrigin: true,
      },
      // cfao-needs, par sa passerelle (compose cfao-needs, port 8082).
      '/api/v1/needs': {
        target: process.env.NEEDS_SERVICE || 'http://localhost:8082',
        changeOrigin: true,
      },
      // Le reste de /api/v1 : cfao-core (/api/v1/core/…). L'ancienne passerelle
      // du port 8000 est retirée.
      '/api/v1': {
        target: process.env.CORE_SERVICE || 'http://localhost:8006',
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
