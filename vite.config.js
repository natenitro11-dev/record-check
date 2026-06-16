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
        }
      }
    }
  }
})
