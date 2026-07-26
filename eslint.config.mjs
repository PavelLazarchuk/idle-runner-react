import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
    { ignores: ['dist/', 'coverage/', 'node_modules/'] },
    ...tseslint.configs.recommended,
    {
        plugins: { 'react-hooks': reactHooks },
        rules: {
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': [
                'error',
                { additionalHooks: '(useIdleTask|useIdleValue|useIdleEffect)' },
            ],
        },
    }
);
