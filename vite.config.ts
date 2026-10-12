import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'

// Every build gets an id, baked into the app and also published as version.json — so a running copy can ask the
// server "is there something newer than me?" (see lib/useNewVersion.ts).
const buildId = Date.now().toString(36)
const versionFile = (): Plugin => ({
  name: 'version-file',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: buildId }) })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), versionFile()],
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  // Relative asset paths, so the built app works from any folder — GitHub Pages serves project sites from /<repo>/.
  base: './',
})
