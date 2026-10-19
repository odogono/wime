import { resolve } from 'node:path';

import nkzw from '@nkzw/eslint-config';

export default [
  {
    ignores: [
      '**/dist/*',
      '**/coverage/*',
      'artifacts/*',
      'build/*',
      'extracted_graphics/*',
      'extracted_text/*'
    ]
  },
  ...nkzw,
  {
    rules: {
      'arrow-body-style': ['error', 'as-needed'],
      'arrow-parens': ['error', 'as-needed'],
      'arrow-spacing': ['error', { after: true, before: true }],
      'func-style': ['error', 'expression'],
      'import-x/no-namespace': 'off',
      'import-x/no-unresolved': ['error', { ignore: ['^bun:'] }],
      'no-var': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-const': 'error'
    },
    settings: {
      'import-x/resolver': {
        typescript: {
          noWarnOnMultipleProjects: true,
          project: [
            resolve(process.cwd(), './tsconfig.json'),
            resolve(process.cwd(), './web/src/sim/tsconfig.json'),
            resolve(process.cwd(), './web/src/view/tsconfig.json'),
            resolve(process.cwd(), './web/tsconfig.test.json')
          ]
        }
      }
    }
  },
  {
    files: ['tools/**/*.ts'],
    rules: {
      'no-console': 'off'
    }
  }
];
