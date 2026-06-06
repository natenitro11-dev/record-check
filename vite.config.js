import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'The Record Check',
          short_name: 'RecordCheck',
          description: 'What the bill says. What they told you. The gap.',
          theme_color: '#0a0f1e',
          background_color: '#0a0f1e',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' }
          ]
        }
      })
    ],
    server: {
      proxy: {
        '/api/congress': {
          target: 'https://api.congress.gov/v3',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/congress/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              const u = new URL('http://x' + req.url)
              u.searchParams.delete('api_key')
              u.searchParams.set('api_key', env.CONGRESS_API_KEY || '')
              proxyReq.path = u.pathname + u.search
            })
          }
        }
      }
    }
  }
})
