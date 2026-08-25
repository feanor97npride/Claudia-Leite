import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'))

// Vercel-style file routing for our small, fixed set of /api endpoints —
// only used by the local dev server below; the real deployment relies on
// Vercel's own file-based routing over the same files under /api.
const STATIC_API_ROUTES: Record<string, string> = {
  '/api/auth/login': '/api/auth/login.ts',
  '/api/auth/logout': '/api/auth/logout.ts',
  '/api/auth/me': '/api/auth/me.ts',
  '/api/auth/change-password': '/api/auth/change-password.ts',
  '/api/users': '/api/users/index.ts',
  '/api/objetivos': '/api/objetivos/index.ts',
  '/api/atividades': '/api/atividades/index.ts',
  '/api/audit-log': '/api/audit-log.ts',
  '/api/debug-db': '/api/debug-db.ts',
}

function resolveApiFile(pathname: string): string | null {
  if (STATIC_API_ROUTES[pathname]) return STATIC_API_ROUTES[pathname]
  if (/^\/api\/objetivos\/[^/]+\/versions$/.test(pathname)) return '/api/objetivos/[id]/versions.ts'
  if (/^\/api\/objetivos\/[^/]+$/.test(pathname)) return '/api/objetivos/[id].ts'
  if (/^\/api\/atividades\/[^/]+$/.test(pathname)) return '/api/atividades/[id].ts'
  return null
}

/** Serves the same /api/*.ts handlers used in production (Vercel serverless
 * functions) from Vite's own dev server, via ssrLoadModule so they get real
 * TS transpilation and can be edited with instant reload like the rest of
 * the app — no separate backend process needed for local development. */
function apiDevMiddleware(): Plugin {
  return {
    name: 'api-dev-middleware',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = (req.url ?? '').split('?')[0]
        if (!pathname.startsWith('/api/')) return next()
        const file = resolveApiFile(pathname)
        if (!file) return next()
        try {
          const mod = await server.ssrLoadModule(file)
          await mod.default(req, res)
        } catch (err) {
          console.error('[api dev]', err)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Erro interno (dev).' }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Loads .env.local (gitignored) into process.env for the dev server's own
  // Node process — the API handlers read process.env.DATABASE_URL directly,
  // same as they will in production on Vercel.
  const env = loadEnv(mode, process.cwd(), '')
  Object.assign(process.env, env)

  return {
    plugins: [react(), apiDevMiddleware()],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
  }
})
