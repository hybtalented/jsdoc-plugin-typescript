// https://eslint.org/docs/user-guide/configuring

module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 2020
  },
  env: {
    browser: true
  },
  // https://github.com/vuejs/eslint-plugin-vue#priority-a-essential-error-prevention
  // consider switching to `plugin:vue/strongly-recommended` or `plugin:vue/recommended` for stricter rules.
  extends: ['plugin:prettier/recommended'],
  // required to lint *.vue files
  plugins: ['prettier'],
  // add your custom rules here
  rules: {
    quotes: [1, 'single', { avoidEscape: true }],
    'quote-props': 0,
    'class-methods-use-this': 0,
    // disallow reassignment of function parameters
    // disallow parameter object manipulation except for specific exclusions
    'no-param-reassign': ['error', { props: false }],
    'no-else-return': 0,
    'vars-on-top': 0,
    'no-shadow': 0,
    'no-shadow-restricted-names': 0,
    'object-property-newline': 0,
    'arrow-parens': ['error', 'as-needed'], // 箭头函数参数括号
    'no-continue': 0,
    'no-nested-ternary': 0,
    'guard-for-in': 0,
    'space-before-function-paren': 0,
    camelcase: 0,
    'comma-dangle': [1, 'never'],
    'comma-spacing': [1, { before: false, after: true }],
    'spaced-comment': [1, 'always', { markers: ['!', '/'] }],
    'comma-style': [2, 'last'],
    'block-scoped-var': 0,
    'consistent-return': 0,
    'no-redeclare': 0,
    'no-mixed-operators': 0,
    'no-prototype-builtins': 0,
    'no-tabs': 1,
    'max-len': 0,
    'object-shorthand': 0, // 强制对象字面量缩写语法
    'no-var': 0,
    'no-plusplus': 0,
    'no-underscore-dangle': 0,
    'import/prefer-default-export': 0,
    'no-restricted-syntax': [
      2,
      {
        selector: "MemberExpression[object.name='top']", //
        message: '禁止使用top'
      }
    ],
    // allow debugger during development
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off'
  }
};
