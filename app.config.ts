import { defineConfig } from "@solidjs/start/config";
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
    vite: {
        html: {
            cspNonce: 'KAAS_IS_AWESOME',
        },
        plugins: [
            VitePWA({
                mode: 'development',
                // srcDir: 'src',
                // filename: 'claims-sw.ts',
                strategies: 'injectManifest',
                registerType: 'autoUpdate',
                base: '/',
                manifest: {
                    name: 'Calque',
                    short_name: 'Calque',
                    theme_color: '#f0f',
                    icons: [],
                },
                devOptions: {
                    enabled: true,
                    type: 'module',
                    navigateFallback: 'index.html',
                },
            }),
        ],
    },
    solid: {
        babel: {
            compact: true,
        },
    },
    server: {
        prerender: {
            crawlLinks: true,
        },
    },
});
