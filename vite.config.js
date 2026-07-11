import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/congress': {
          target: 'https://api.congress.gov/v3',
          changeOrigin: true,
          rewrite: (path) => {
            const u = new URL('http://x' + path.replace(/^\/api\/congress/, ''))
            u.searchParams.delete('api_key')
            u.searchParams.set('api_key', env.CONGRESS_API_KEY || '')
            return u.pathname + u.search
          }
        },
        '/api/anthropic': {
          target: 'https://api.anthropic.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              const apiKey = env.VITE_ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY || '';
              if (apiKey) {
                proxyReq.setHeader('x-api-key', apiKey);
              }
              proxyReq.setHeader('anthropic-version', '2023-06-01');
              proxyReq.setHeader('content-type', 'application/json');
            });
          }
        }
      }
    }
  }
})
