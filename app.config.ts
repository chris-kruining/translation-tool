import { defineConfig } from "@solidjs/start/config";
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
    vite: {
        plugins: [
            VitePWA({ registerType: 'autoUpdate' }),
        ]
    }
});
