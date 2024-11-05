import solid from "vite-plugin-solid"
import { defineConfig } from "vitest/config"

export default defineConfig({
    plugins: [solid()],
    root: './src',
    resolve: {
        conditions: ["development", "browser"],
    },
})