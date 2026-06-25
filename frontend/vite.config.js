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

export default defineConfig({
  plugins: [react(), cataloguesFallbackPlugin()],
  publicDir: 'public',
  server: {
    fs: { allow: ['..'] },
    proxy: {
      '/medacap-api': {
        target: 'http://localhost',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/medacap-api/, '/medacap'),
      },
    },
  },
})
