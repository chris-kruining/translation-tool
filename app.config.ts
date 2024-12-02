import { defineConfig } from '@solidjs/start/config';
import solidSvg from 'vite-plugin-solid-svg'
// import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
    vite: {
        html: {
            cspNonce: 'KAAS_IS_AWESOME',
        },
        plugins: [
            solidSvg()
            // VitePWA({
            //     strategies: 'injectManifest',
            //     registerType: 'autoUpdate',
            //     injectRegister: false,

            //     workbox: {
            //         globPatterns: ['**/*.{js,css,html,svg,png,svg,ico}'],
            //         cleanupOutdatedCaches: true,
            //         clientsClaim: true,
            //     },
            //     injectManifest: {
            //         globPatterns: ['**/*.{js,css,html,svg,png,svg,ico}'],
            //     },

            //     manifest: {
            //         name: 'Calque - manage your i18n files',
            //         short_name: 'KAAS',
            //         description: 'Simple tool for maitaining i18n files',
            //         icons: [
            //             {
            //                 src: '/images/favicon.dark.svg',
            //                 type: 'image/svg+xml',
            //                 sizes: 'any'
            //             }
            //         ],
            //         display_override: ['window-controls-overlay'],
            //         screenshots: [
            //             {
            //                 src: '/images/screenshots/narrow.png',
            //                 type: 'image/png',
            //                 sizes: '538x1133',
            //                 form_factor: 'narrow'
            //             },
            //             {
            //                 src: '/images/screenshots/wide.png',
            //                 type: 'image/png',
            //                 sizes: '2092x1295',
            //                 form_factor: 'wide'
            //             }
            //         ],
            //         file_handlers: [
            //             {
            //                 action: '/edit',
            //                 accept: {
            //                     'text/*': [
            //                         '.json'
            //                     ]
            //                 }
            //             }
            //         ]
            //     },

            //     devOptions: {
            //         enabled: true,
            //         type: 'module',
            //         navigateFallback: 'index.html',
            //     },
            // }),
        ],
    },
    solid: {
        babel: {
            compact: true,
        },
    },
    server: {
        preset: 'bun',
        // prerender: {
        //     crawlLinks: true,
        // },
    },
});
