import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Une adresse, applications par chemin (PLAN-chemins-edge.md) : needs vit sous /besoins/.
  base: '/besoins/',
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      // En dev on tape l'API directement ; en conteneur c'est la passerelle nginx.
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
  build: { outDir: 'dist', sourcemap: false },
  test: {
    // jsdom : les tests portent sur des comportements navigateur (cycle de vie du
    // document, requetes sortantes). Un environnement node ne les couvrirait pas.
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{js,jsx}'],
  },
})
