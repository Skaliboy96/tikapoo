import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'esnext'
  },
server: {
    host: true,
    port: 3000,
    open: false,
    allowedHosts: true,
    watch: {
      // Exclude non-game asset folders from the file watcher to prevent EBUSY errors
      ignored: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.blend',
        '**/*.blend1',
        '**/Universal Animation Library*/**',
        '**/Fantasy Props MegaKit*/**',
        '**/Medieval Village MegaKit*/**',
        '**/Modular Character Outfits*/**',
        '**/Stylized Nature MegaKit*/**',
        '**/Survival Pack*/**',
      ]
    }
  },
  // Only watch and serve files from the game source
  root: '.',
});
