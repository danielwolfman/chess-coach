import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
// Force Tailwind v4 to use JS fallback instead of native binding
// to avoid Lightning CSS native binary issues on some Node/OS setups (e.g., Node 22 on Windows)
process.env.TAILWIND_DISABLE_NATIVE = process.env.TAILWIND_DISABLE_NATIVE || '1';
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), tsconfigPaths()],
    server: {
        port: 5173,
        open: true,
    },
    preview: {
        port: 5173,
    },
});
