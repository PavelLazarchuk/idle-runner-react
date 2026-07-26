import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
    test: {
        projects: [
            {
                test: {
                    name: 'unit',
                    environment: 'jsdom',
                    include: ['test/**/*.test.tsx', 'test/**/*.test.ts'],
                    exclude: ['test/browser/**', 'test/ssr.test.tsx'],
                },
            },
            {
                test: {
                    name: 'ssr',
                    environment: 'node',
                    include: ['test/ssr.test.tsx'],
                },
            },
            {
                test: {
                    name: 'browser',
                    include: ['test/browser/**/*.test.tsx'],
                    browser: {
                        enabled: true,
                        headless: true,
                        provider: playwright(),
                        instances: [{ browser: 'chromium' }, { browser: 'webkit' }],
                    },
                },
            },
        ],
    },
});
