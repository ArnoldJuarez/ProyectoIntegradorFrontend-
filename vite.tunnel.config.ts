import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Config solo para enseñar el avance por un tunel de cloudflared:
//   npx vite --config vite.tunnel.config.ts
//
// El navegador habla solo con Vite (mismo origen) y Vite reenvia /api al
// backend. Asi la cookie de sesion y CORS funcionan sin tocar el backend.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(''),
  },
  server: {
    port: 5174,
    strictPort: true,
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': {
        target: process.env.BACKEND ?? 'http://localhost:8090',
        changeOrigin: true,
        configure: (proxy) => {
          // Sin Origin, Spring no lo trata como peticion CORS de otro dominio.
          proxy.on('proxyReq', (req) => req.removeHeader('origin'))
        },
      },
    },
  },
})
