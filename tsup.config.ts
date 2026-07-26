import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    target: 'es2020',
    sourcemap: true,
    clean: true,
    banner: { js: "'use client';" },
    external: ['react', 'react-dom', '@idle-runner/core'],
    esbuildOptions(options) {
        options.mangleProps = /^_/;
    },
});
