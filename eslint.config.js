import js from '@eslint/js';

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '*.min.js',
      'coverage/**',
      '**/*.html' // Exclude HTML files from ESLint parsing
    ]
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        alert: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        performance: 'readonly',
        Worker: 'readonly',
        fetch: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        requestIdleCallback: 'readonly',
        URL: 'readonly',
        self: 'readonly',
        navigator: 'readonly',
        importScripts: 'readonly',
        exposeToWindow: 'readonly',
        // Node.js globals
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly'
      }
    },
    rules: {
      // Possible Errors - Enhanced
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-duplicate-case': 'error',
      'no-empty': 'warn',
      'no-extra-semi': 'error',
      'no-func-assign': 'error',
      'no-irregular-whitespace': 'error',
      'no-unreachable': 'error',
      'no-unused-vars': 'warn',
      'valid-typeof': 'error',
      'no-undef': 'error',
      'no-global-assign': 'error',

      // Best Practices - Optimized
      'curly': 'error',
      'dot-notation': 'warn',
      'eqeqeq': 'error',
      'no-alert': 'warn',
      'no-else-return': 'warn',
      'no-empty-function': 'warn',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-invalid-this': 'error',
      'no-multi-spaces': 'error',
      'no-new': 'warn',
      'no-redeclare': 'error',
      'no-return-assign': 'error',
      'no-script-url': 'error',
      'no-self-compare': 'error',
      'no-sequences': 'error',
      'no-throw-literal': 'error',
      'no-unused-expressions': 'error',
      'no-useless-call': 'error',
      'no-useless-concat': 'error',
      'no-useless-return': 'error',
      'prefer-promise-reject-errors': 'error',
      'radix': 'error',

      // Modern JavaScript - ES6+ Features
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-rest-params': 'error',
      'prefer-spread': 'error',
      'prefer-template': 'error',
      'arrow-spacing': 'error',
      'constructor-super': 'error',
      'no-class-assign': 'error',
      'no-const-assign': 'error',
      'no-dupe-class-members': 'error',
      'no-duplicate-imports': 'error',
      'no-new-symbol': 'error',
      'no-this-before-super': 'error',
      'require-yield': 'error',
      'rest-spread-spacing': 'error',
      'template-curly-spacing': 'error',

      // Code Quality
      'complexity': ['warn', 15],
      'max-depth': ['warn', 4],
      'max-lines': ['warn', 500],
      'max-params': ['warn', 5],

      // Stylistic (Essential Only - Use Prettier for formatting)
      'indent': ['error', 2, { 'SwitchCase': 1 }],
      'quotes': ['error', 'single', { 'allowTemplateLiterals': true }],
      'semi': ['error', 'always'],
      'comma-dangle': ['error', 'never'],
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],
      'brace-style': ['error', '1tbs', { 'allowSingleLine': true }],
      'camelcase': ['error', { 'properties': 'never' }]
    }
  },
  {
    // Specific rules for JavaScript files in browser context
    files: ['**/*.js'],
    rules: {
      // Allow browser-specific APIs that might not be in all environments
      'no-undef': ['error', { 'typeof': true }]
    }
  },
  {
    // Specific rules for Web Worker files
    files: ['**/*Worker*.js', '**/textLengthWorker.js', '**/wordFrequencyWorker.js'],
    languageOptions: {
      globals: {
        self: 'readonly',
        importScripts: 'readonly',
        postMessage: 'readonly',
        onmessage: 'writable',
        onerror: 'writable'
      }
    }
  }
];