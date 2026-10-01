import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const ollamaProxy = {
  '/api/ollama': {
    target: 'http://127.0.0.1:11434',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api\/ollama/, ''),
  },
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_')

  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [react()],
    server: {
      proxy: ollamaProxy,
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },
    preview: {
      proxy: ollamaProxy,
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },
    test: {
      environment: 'jsdom',
      environmentOptions: { jsdom: { url: 'http://localhost/' } },
      setupFiles: ['src/test-setup.ts'],
      restoreMocks: true,
      clearMocks: true,
      coverage: {
        include: ['src/hooks/**/*.ts', 'src/lib/**/*.ts', 'src/components/ChessBoard.tsx'],
        exclude: ['**/*.test.ts', '**/*.test.tsx'],
      },
    },
  }
})