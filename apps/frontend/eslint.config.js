import reactConfig from '@flopods/eslint-config/react.js';

export default [
  ...reactConfig,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
