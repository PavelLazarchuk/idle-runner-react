export default {
    '**/*.{ts,tsx}': [
        'prettier --write',
        'eslint --fix --max-warnings=0',
        'vitest related --run --project unit',
    ],
    '**/*.{json,md,yml,yaml,mjs}': ['prettier --write'],
};
