import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  {
    ignores: [
      '.next/',
      'out/',
      'src/lib/api/schema.d.ts',
      'public/mockServiceWorker.js',
      'node_modules/',
      'next-env.d.ts',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
];
export default config;
